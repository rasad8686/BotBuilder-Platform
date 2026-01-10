import React, { useState } from 'react';
import { Upload, Link, Image } from 'lucide-react';
import AlignmentPicker from './AlignmentPicker';

const ImageSettings = ({ block, settings, onSettingsChange }) => {
  const [uploadTab, setUploadTab] = useState('url');

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Create FormData for upload
    const formData = new FormData();
    formData.append('image', file);

    try {
      // In a real implementation, this would upload to your server
      // For now, we'll create a local object URL for preview
      const url = URL.createObjectURL(file);
      onSettingsChange('src', url);
    } catch (error) {
      console.error('Upload failed:', error);
    }
  };

  return (
    <div className="space-y-4">
      {/* Image Source Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setUploadTab('url')}
          className={`flex-1 px-4 py-2 text-sm font-medium flex items-center justify-center gap-2 ${
            uploadTab === 'url'
              ? 'text-purple-600 border-b-2 border-purple-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Link className="w-4 h-4" />
          URL
        </button>
        <button
          onClick={() => setUploadTab('upload')}
          className={`flex-1 px-4 py-2 text-sm font-medium flex items-center justify-center gap-2 ${
            uploadTab === 'upload'
              ? 'text-purple-600 border-b-2 border-purple-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Upload className="w-4 h-4" />
          Upload
        </button>
      </div>

      {uploadTab === 'url' ? (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Image URL
          </label>
          <input
            type="text"
            value={settings.src || ''}
            onChange={(e) => onSettingsChange('src', e.target.value)}
            placeholder="https://example.com/image.jpg"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
          />
        </div>
      ) : (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Upload Image
          </label>
          <div className="relative border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center hover:border-purple-500 transition-colors">
            <input
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <Image className="w-8 h-8 mx-auto text-gray-400 mb-2" />
            <p className="text-sm text-gray-500">
              Click or drag image here
            </p>
            <p className="text-xs text-gray-400 mt-1">
              PNG, JPG, GIF up to 5MB
            </p>
          </div>
        </div>
      )}

      {/* Image Preview */}
      {settings.src && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Preview
          </label>
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <img
              src={settings.src}
              alt="Preview"
              className="max-w-full h-auto"
              style={{ maxHeight: '150px' }}
            />
          </div>
        </div>
      )}

      {/* Alt Text */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Alt Text
        </label>
        <input
          type="text"
          value={settings.alt || ''}
          onChange={(e) => onSettingsChange('alt', e.target.value)}
          placeholder="Describe the image"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
        />
        <p className="text-xs text-gray-500 mt-1">
          Important for accessibility and SEO
        </p>
      </div>

      {/* Link URL */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Link URL (optional)
        </label>
        <input
          type="text"
          value={settings.link || ''}
          onChange={(e) => onSettingsChange('link', e.target.value)}
          placeholder="https://example.com"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
        />
      </div>

      {/* Width */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Width
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={settings.width || '100%'}
            onChange={(e) => onSettingsChange('width', e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
          />
          <select
            value={settings.width?.includes('%') ? '%' : 'px'}
            onChange={(e) => {
              const current = parseInt(settings.width) || 100;
              onSettingsChange('width', `${current}${e.target.value}`);
            }}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
          >
            <option value="%">%</option>
            <option value="px">px</option>
          </select>
        </div>
      </div>

      {/* Alignment */}
      <AlignmentPicker
        value={settings.align || 'center'}
        onChange={(value) => onSettingsChange('align', value)}
      />

      {/* Border Radius */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Border Radius
        </label>
        <input
          type="text"
          value={settings.borderRadius || '0px'}
          onChange={(e) => onSettingsChange('borderRadius', e.target.value)}
          placeholder="0px"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
        />
      </div>
    </div>
  );
};

export default ImageSettings;
