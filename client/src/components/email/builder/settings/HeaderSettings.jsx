import React, { useState } from 'react';
import { Upload, Link, Image } from 'lucide-react';
import ColorPicker from './ColorPicker';
import AlignmentPicker from './AlignmentPicker';

const HeaderSettings = ({ block, settings, onSettingsChange }) => {
  const [uploadTab, setUploadTab] = useState('url');

  return (
    <div className="space-y-4">
      {/* Logo Source Tabs */}
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
            Logo URL
          </label>
          <input
            type="text"
            value={settings.logo || ''}
            onChange={(e) => onSettingsChange('logo', e.target.value)}
            placeholder="https://example.com/logo.png"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
          />
        </div>
      ) : (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Upload Logo
          </label>
          <div className="relative border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center hover:border-purple-500 transition-colors">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const url = URL.createObjectURL(file);
                  onSettingsChange('logo', url);
                }
              }}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <Image className="w-8 h-8 mx-auto text-gray-400 mb-2" />
            <p className="text-sm text-gray-500">Click or drag logo here</p>
          </div>
        </div>
      )}

      {/* Logo Preview */}
      {settings.logo && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Preview
          </label>
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800 text-center">
            <img
              src={settings.logo}
              alt="Logo preview"
              style={{
                width: settings.logoWidth || '150px',
                maxWidth: '100%',
                height: 'auto'
              }}
              className="inline-block"
            />
          </div>
        </div>
      )}

      {/* Logo Width */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Logo Width
        </label>
        <input
          type="text"
          value={settings.logoWidth || '150px'}
          onChange={(e) => onSettingsChange('logoWidth', e.target.value)}
          placeholder="150px"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
        />
      </div>

      {/* Logo Alignment */}
      <AlignmentPicker
        label="Logo Alignment"
        value={settings.logoAlign || 'center'}
        onChange={(value) => onSettingsChange('logoAlign', value)}
      />

      {/* Background Color */}
      <ColorPicker
        label="Background Color"
        value={settings.backgroundColor || '#FFFFFF'}
        onChange={(value) => onSettingsChange('backgroundColor', value)}
      />
    </div>
  );
};

export default HeaderSettings;
