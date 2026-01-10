import { forwardRef, useState } from 'react';
import { User } from 'lucide-react';

/**
 * Avatar Component with fallback support
 * Follows BotBuilder Design System tokens
 */
const Avatar = forwardRef(({
  src,
  alt = '',
  name,
  size = 'md',
  shape = 'circle',
  status,
  className = '',
  ...props
}, ref) => {
  const [imgError, setImgError] = useState(false);

  const sizes = {
    xs: 'w-6 h-6 text-xs',
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-lg',
    '2xl': 'w-20 h-20 text-xl'
  };

  const iconSizes = {
    xs: 'w-3 h-3',
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
    xl: 'w-8 h-8',
    '2xl': 'w-10 h-10'
  };

  const shapes = {
    circle: 'rounded-full',
    square: 'rounded-lg',
    rounded: 'rounded-xl'
  };

  const statusColors = {
    online: 'bg-emerald-500',
    offline: 'bg-gray-400',
    away: 'bg-amber-500',
    busy: 'bg-red-500'
  };

  const statusSizes = {
    xs: 'w-1.5 h-1.5 border',
    sm: 'w-2 h-2 border',
    md: 'w-2.5 h-2.5 border-2',
    lg: 'w-3 h-3 border-2',
    xl: 'w-4 h-4 border-2',
    '2xl': 'w-5 h-5 border-2'
  };

  // Generate initials from name
  const getInitials = (name) => {
    if (!name) return '';
    const parts = name.trim().split(' ');
    if (parts.length === 1) {
      return parts[0].charAt(0).toUpperCase();
    }
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  // Generate a consistent color from name
  const getColorFromName = (name) => {
    if (!name) return 'bg-gray-200 dark:bg-slate-700';
    const colors = [
      'bg-purple-500',
      'bg-blue-500',
      'bg-emerald-500',
      'bg-amber-500',
      'bg-rose-500',
      'bg-cyan-500',
      'bg-indigo-500',
      'bg-pink-500'
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const showImage = src && !imgError;
  const showInitials = !showImage && name;
  const showFallback = !showImage && !name;

  return (
    <div
      ref={ref}
      className={`
        relative inline-flex items-center justify-center
        ${sizes[size]}
        ${shapes[shape]}
        overflow-hidden
        flex-shrink-0
        ${showFallback ? 'bg-gray-200 dark:bg-slate-700' : ''}
        ${showInitials ? getColorFromName(name) : ''}
        ${className}
      `}
      {...props}
    >
      {showImage && (
        <img
          src={src}
          alt={alt || name || 'Avatar'}
          onError={() => setImgError(true)}
          className={`w-full h-full object-cover ${shapes[shape]}`}
        />
      )}
      {showInitials && (
        <span className="font-medium text-white select-none">
          {getInitials(name)}
        </span>
      )}
      {showFallback && (
        <User className={`${iconSizes[size]} text-gray-400 dark:text-gray-500`} />
      )}

      {/* Status Indicator */}
      {status && (
        <span
          className={`
            absolute bottom-0 right-0
            ${statusSizes[size]}
            ${statusColors[status]}
            ${shape === 'circle' ? 'rounded-full' : 'rounded-full'}
            border-white dark:border-slate-800
          `}
        />
      )}
    </div>
  );
});

Avatar.displayName = 'Avatar';

/**
 * Avatar Group - Stack multiple avatars
 */
const AvatarGroup = forwardRef(({
  children,
  max = 4,
  size = 'md',
  className = '',
  ...props
}, ref) => {
  const childArray = Array.isArray(children) ? children : [children];
  const visibleAvatars = childArray.slice(0, max);
  const remainingCount = childArray.length - max;

  const overlapSizes = {
    xs: '-space-x-2',
    sm: '-space-x-2.5',
    md: '-space-x-3',
    lg: '-space-x-4',
    xl: '-space-x-5',
    '2xl': '-space-x-6'
  };

  const counterSizes = {
    xs: 'w-6 h-6 text-xs',
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-sm',
    xl: 'w-16 h-16 text-base',
    '2xl': 'w-20 h-20 text-lg'
  };

  return (
    <div
      ref={ref}
      className={`flex items-center ${overlapSizes[size]} ${className}`}
      {...props}
    >
      {visibleAvatars.map((child, index) => (
        <div
          key={index}
          className="relative ring-2 ring-white dark:ring-slate-900 rounded-full"
          style={{ zIndex: visibleAvatars.length - index }}
        >
          {child}
        </div>
      ))}
      {remainingCount > 0 && (
        <div
          className={`
            relative flex items-center justify-center
            ${counterSizes[size]}
            rounded-full
            bg-gray-200 dark:bg-slate-700
            text-gray-600 dark:text-gray-300
            font-medium
            ring-2 ring-white dark:ring-slate-900
          `}
          style={{ zIndex: 0 }}
        >
          +{remainingCount}
        </div>
      )}
    </div>
  );
});

AvatarGroup.displayName = 'AvatarGroup';

export { Avatar, AvatarGroup };
export default Avatar;
