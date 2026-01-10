import React from 'react';
import { Play, Video as VideoIcon } from 'lucide-react';

const VideoBlock = ({ block, onUpdate, isEditing }) => {
  const { settings = {} } = block;

  const containerStyle = {
    textAlign: 'center',
    padding: settings.padding
      ? `${settings.padding.top || 0}px ${settings.padding.right || 0}px ${settings.padding.bottom || 0}px ${settings.padding.left || 0}px`
      : '10px 0'
  };

  if (!settings.thumbnailUrl) {
    return (
      <div style={containerStyle}>
        <div
          className="relative bg-gray-100 dark:bg-gray-700 rounded-lg flex flex-col items-center justify-center mx-auto"
          style={{
            width: settings.width || '100%',
            minHeight: '200px'
          }}
        >
          <VideoIcon className="w-12 h-12 text-gray-400 mb-2" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Add a video thumbnail
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Video will link to URL when clicked
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <a
        href={settings.videoUrl || '#'}
        onClick={(e) => {
          if (!settings.videoUrl || isEditing) {
            e.preventDefault();
          }
        }}
        className="relative inline-block group"
        style={{ width: settings.width || '100%' }}
      >
        <img
          src={settings.thumbnailUrl}
          alt="Video thumbnail"
          className="w-full rounded-lg"
          style={{ width: settings.width || '100%' }}
        />
        {/* Play button overlay */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center transition-transform group-hover:scale-110"
            style={{
              backgroundColor: settings.playButtonColor || '#FF0000'
            }}
          >
            <Play className="w-8 h-8 text-white ml-1" fill="white" />
          </div>
        </div>
      </a>
    </div>
  );
};

export default VideoBlock;
