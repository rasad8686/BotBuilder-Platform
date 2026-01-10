import React from 'react';
import { Video, Link, Upload, Image, Play } from 'lucide-react';
import ColorPicker from './ColorPicker';

const VideoSettings = ({ block, settings, onSettingsChange }) => {
  // Extract video ID for thumbnail generation
  const getYouTubeThumbnail = (url) => {
    if (!url) return null;
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
    return match ? `https://img.youtube.com/vi/${match[1]}/maxresdefault.jpg` : null;
  };

  const getVimeoId = (url) => {
    if (!url) return null;
    const match = url.match(/vimeo\.com\/(\d+)/);
    return match ? match[1] : null;
  };

  const handleVideoUrlChange = (url) => {
    onSettingsChange('videoUrl', url);

    // Auto-detect thumbnail for YouTube
    const ytThumbnail = getYouTubeThumbnail(url);
    if (ytThumbnail && !settings.thumbnailUrl) {
      onSettingsChange('thumbnailUrl', ytThumbnail);
    }
  };

  return (
    <div className="space-y-4">
      {/* Info */}
      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <p className="text-xs text-blue-700 dark:text-blue-300">
          Videos cannot play directly in emails. This creates a clickable thumbnail that links to your video.
        </p>
      </div>

      {/* Video URL */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Video URL
        </label>
        <input
          type="text"
          value={settings.videoUrl || ''}
          onChange={(e) => handleVideoUrlChange(e.target.value)}
          placeholder="https://youtube.com/watch?v=..."
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
        />
        <p className="text-xs text-gray-500 mt-1">
          Supports YouTube, Vimeo, and any video URL
        </p>
      </div>

      {/* Thumbnail URL */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Thumbnail URL
        </label>
        <input
          type="text"
          value={settings.thumbnailUrl || ''}
          onChange={(e) => onSettingsChange('thumbnailUrl', e.target.value)}
          placeholder="https://example.com/thumbnail.jpg"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
        />

        {/* Auto-detect button for YouTube */}
        {settings.videoUrl && getYouTubeThumbnail(settings.videoUrl) && (
          <button
            onClick={() => onSettingsChange('thumbnailUrl', getYouTubeThumbnail(settings.videoUrl))}
            className="mt-2 text-xs text-purple-600 hover:text-purple-700"
          >
            Auto-detect YouTube thumbnail
          </button>
        )}
      </div>

      {/* Thumbnail Upload */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Or Upload Thumbnail
        </label>
        <div className="relative border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 text-center hover:border-purple-500 transition-colors">
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                const url = URL.createObjectURL(file);
                onSettingsChange('thumbnailUrl', url);
              }
            }}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <Image className="w-6 h-6 mx-auto text-gray-400 mb-1" />
          <p className="text-xs text-gray-500">Click to upload</p>
        </div>
      </div>

      {/* Thumbnail Preview */}
      {settings.thumbnailUrl && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Preview
          </label>
          <div className="relative border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <img
              src={settings.thumbnailUrl}
              alt="Video thumbnail"
              className="w-full h-auto"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ backgroundColor: settings.playButtonColor || '#FF0000' }}
              >
                <Play className="w-6 h-6 text-white ml-1" fill="white" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Play Button Color */}
      <ColorPicker
        label="Play Button Color"
        value={settings.playButtonColor || '#FF0000'}
        onChange={(value) => onSettingsChange('playButtonColor', value)}
        presets={['#FF0000', '#7C3AED', '#2563EB', '#000000', '#FFFFFF']}
      />

      {/* Width */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Width
        </label>
        <select
          value={settings.width || '100%'}
          onChange={(e) => onSettingsChange('width', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
        >
          <option value="50%">50%</option>
          <option value="75%">75%</option>
          <option value="100%">100%</option>
        </select>
      </div>
    </div>
  );
};

export default VideoSettings;
