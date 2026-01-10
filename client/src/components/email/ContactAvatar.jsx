import React, { useState, useEffect } from 'react';
import md5 from 'md5';

const ContactAvatar = ({
  email,
  name,
  size = 'md',
  status,
  showStatusDot = false
}) => {
  const [imageError, setImageError] = useState(false);

  // Reset error when email changes
  useEffect(() => {
    setImageError(false);
  }, [email]);

  // Size configurations
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-14 h-14 text-lg',
    xl: 'w-20 h-20 text-xl'
  };

  const dotSizes = {
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
    lg: 'w-3 h-3',
    xl: 'w-4 h-4'
  };

  const dotPositions = {
    sm: 'bottom-0 right-0',
    md: 'bottom-0 right-0',
    lg: '-bottom-0.5 -right-0.5',
    xl: '-bottom-1 -right-1'
  };

  // Status dot colors
  const statusColors = {
    subscribed: 'bg-green-500',
    unsubscribed: 'bg-gray-400',
    bounced: 'bg-red-500',
    complained: 'bg-orange-500'
  };

  // Generate initials
  const getInitials = () => {
    if (name) {
      const parts = name.trim().split(' ');
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
      }
      return parts[0][0].toUpperCase();
    }
    if (email) {
      return email[0].toUpperCase();
    }
    return '?';
  };

  // Generate background color based on email
  const getBackgroundColor = () => {
    const colors = [
      'bg-blue-500',
      'bg-green-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-indigo-500',
      'bg-teal-500',
      'bg-orange-500',
      'bg-cyan-500'
    ];

    if (!email) return colors[0];

    const hash = email.split('').reduce((acc, char) => {
      return char.charCodeAt(0) + ((acc << 5) - acc);
    }, 0);

    return colors[Math.abs(hash) % colors.length];
  };

  // Gravatar URL
  const getGravatarUrl = () => {
    if (!email) return null;
    const hash = md5(email.toLowerCase().trim());
    const sizePixels = {
      sm: 32,
      md: 40,
      lg: 56,
      xl: 80
    };
    return `https://www.gravatar.com/avatar/${hash}?s=${sizePixels[size]}&d=404`;
  };

  const gravatarUrl = getGravatarUrl();

  return (
    <div className={`relative flex-shrink-0 ${sizeClasses[size]}`}>
      {gravatarUrl && !imageError ? (
        <img
          src={gravatarUrl}
          alt={name || email}
          className={`${sizeClasses[size]} rounded-full object-cover`}
          onError={() => setImageError(true)}
        />
      ) : (
        <div className={`
          ${sizeClasses[size]}
          ${getBackgroundColor()}
          rounded-full flex items-center justify-center text-white font-medium
        `}>
          {getInitials()}
        </div>
      )}

      {/* Status dot */}
      {showStatusDot && status && (
        <span className={`
          absolute ${dotPositions[size]}
          ${dotSizes[size]}
          ${statusColors[status] || statusColors.subscribed}
          rounded-full border-2 border-white dark:border-slate-800
        `} />
      )}
    </div>
  );
};

export default ContactAvatar;
