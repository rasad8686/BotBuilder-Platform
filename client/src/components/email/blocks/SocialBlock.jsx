import React from 'react';
import { Facebook, Twitter, Instagram, Linkedin, Youtube } from 'lucide-react';

const SOCIAL_ICONS = {
  facebook: Facebook,
  twitter: Twitter,
  instagram: Instagram,
  linkedin: Linkedin,
  youtube: Youtube
};

const SOCIAL_COLORS = {
  facebook: '#1877F2',
  twitter: '#1DA1F2',
  instagram: '#E4405F',
  linkedin: '#0A66C2',
  youtube: '#FF0000'
};

const SocialBlock = ({ block, onUpdate, isEditing }) => {
  const { settings = {} } = block;

  const containerStyle = {
    textAlign: settings.align || 'center',
    padding: settings.padding
      ? `${settings.padding.top || 0}px ${settings.padding.right || 0}px ${settings.padding.bottom || 0}px ${settings.padding.left || 0}px`
      : '10px 0'
  };

  const platforms = settings.platforms || [
    { name: 'facebook', url: '', enabled: true },
    { name: 'twitter', url: '', enabled: true },
    { name: 'instagram', url: '', enabled: true }
  ];

  const iconSize = parseInt(settings.iconSize) || 32;
  const spacing = settings.spacing || '10px';
  const iconStyle = settings.iconStyle || 'colored';

  return (
    <div style={containerStyle}>
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: spacing
        }}
      >
        {platforms.filter(p => p.enabled).map((platform) => {
          const Icon = SOCIAL_ICONS[platform.name];
          if (!Icon) return null;

          const color = iconStyle === 'colored'
            ? SOCIAL_COLORS[platform.name]
            : iconStyle === 'black'
              ? '#000000'
              : '#FFFFFF';

          return (
            <a
              key={platform.name}
              href={platform.url || '#'}
              onClick={(e) => {
                if (!platform.url || isEditing) {
                  e.preventDefault();
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: iconSize,
                height: iconSize,
                borderRadius: '50%',
                backgroundColor: iconStyle === 'white' ? '#374151' : 'transparent',
                textDecoration: 'none'
              }}
              title={platform.name}
            >
              <Icon
                style={{
                  width: iconSize * 0.6,
                  height: iconSize * 0.6,
                  color
                }}
              />
            </a>
          );
        })}
      </div>
    </div>
  );
};

export default SocialBlock;
