import React from 'react';
import { Facebook, Twitter, Instagram, Linkedin, Youtube } from 'lucide-react';
import AlignmentPicker from './AlignmentPicker';

const SOCIAL_PLATFORMS = [
  { name: 'facebook', label: 'Facebook', icon: Facebook, color: '#1877F2' },
  { name: 'twitter', label: 'Twitter', icon: Twitter, color: '#1DA1F2' },
  { name: 'instagram', label: 'Instagram', icon: Instagram, color: '#E4405F' },
  { name: 'linkedin', label: 'LinkedIn', icon: Linkedin, color: '#0A66C2' },
  { name: 'youtube', label: 'YouTube', icon: Youtube, color: '#FF0000' }
];

const SocialSettings = ({ block, settings, onSettingsChange }) => {
  const platforms = settings.platforms || SOCIAL_PLATFORMS.map(p => ({
    name: p.name,
    url: '',
    enabled: p.name === 'facebook' || p.name === 'twitter' || p.name === 'instagram'
  }));

  const handlePlatformToggle = (platformName) => {
    const updated = platforms.map(p =>
      p.name === platformName ? { ...p, enabled: !p.enabled } : p
    );
    onSettingsChange('platforms', updated);
  };

  const handleUrlChange = (platformName, url) => {
    const updated = platforms.map(p =>
      p.name === platformName ? { ...p, url } : p
    );
    onSettingsChange('platforms', updated);
  };

  return (
    <div className="space-y-4">
      {/* Platforms */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Social Platforms
        </label>
        <div className="space-y-3">
          {SOCIAL_PLATFORMS.map(platform => {
            const Icon = platform.icon;
            const platformData = platforms.find(p => p.name === platform.name) || { enabled: false, url: '' };

            return (
              <div
                key={platform.name}
                className={`p-3 border rounded-lg transition-colors ${
                  platformData.enabled
                    ? 'border-purple-300 dark:border-purple-600 bg-purple-50 dark:bg-purple-900/20'
                    : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Icon style={{ color: platform.color }} className="w-5 h-5" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {platform.label}
                    </span>
                  </div>
                  <button
                    onClick={() => handlePlatformToggle(platform.name)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      platformData.enabled ? 'bg-purple-600' : 'bg-gray-200 dark:bg-gray-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                        platformData.enabled ? 'translate-x-5' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
                {platformData.enabled && (
                  <input
                    type="text"
                    value={platformData.url || ''}
                    onChange={(e) => handleUrlChange(platform.name, e.target.value)}
                    placeholder={`https://${platform.name}.com/yourpage`}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Icon Style */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Icon Style
        </label>
        <div className="flex gap-2">
          {['colored', 'black', 'white'].map(style => (
            <button
              key={style}
              onClick={() => onSettingsChange('iconStyle', style)}
              className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors capitalize ${
                settings.iconStyle === style
                  ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30 text-purple-600'
                  : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {style}
            </button>
          ))}
        </div>
      </div>

      {/* Icon Size */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Icon Size
        </label>
        <select
          value={settings.iconSize || '32px'}
          onChange={(e) => onSettingsChange('iconSize', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
        >
          <option value="24px">Small (24px)</option>
          <option value="32px">Medium (32px)</option>
          <option value="40px">Large (40px)</option>
          <option value="48px">Extra Large (48px)</option>
        </select>
      </div>

      {/* Spacing */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Icon Spacing
        </label>
        <select
          value={settings.spacing || '10px'}
          onChange={(e) => onSettingsChange('spacing', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
        >
          <option value="5px">Tight (5px)</option>
          <option value="10px">Normal (10px)</option>
          <option value="15px">Loose (15px)</option>
          <option value="20px">Extra Loose (20px)</option>
        </select>
      </div>

      {/* Alignment */}
      <AlignmentPicker
        value={settings.align || 'center'}
        onChange={(value) => onSettingsChange('align', value)}
      />
    </div>
  );
};

export default SocialSettings;
