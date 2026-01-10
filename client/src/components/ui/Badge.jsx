import { forwardRef } from 'react';

/**
 * Badge Component with variants and sizes
 * Follows BotBuilder Design System tokens
 */
const Badge = forwardRef(({
  children,
  variant = 'default',
  size = 'md',
  dot = false,
  removable = false,
  onRemove,
  className = '',
  ...props
}, ref) => {
  const variants = {
    default: `
      bg-gray-100 text-gray-700
      dark:bg-slate-700 dark:text-gray-300
    `,
    primary: `
      bg-purple-100 text-purple-700
      dark:bg-purple-900/30 dark:text-purple-300
    `,
    secondary: `
      bg-blue-100 text-blue-700
      dark:bg-blue-900/30 dark:text-blue-300
    `,
    success: `
      bg-emerald-100 text-emerald-700
      dark:bg-emerald-900/30 dark:text-emerald-300
    `,
    warning: `
      bg-amber-100 text-amber-700
      dark:bg-amber-900/30 dark:text-amber-300
    `,
    error: `
      bg-red-100 text-red-700
      dark:bg-red-900/30 dark:text-red-300
    `,
    info: `
      bg-blue-100 text-blue-700
      dark:bg-blue-900/30 dark:text-blue-300
    `,
    outline: `
      bg-transparent border border-gray-300 text-gray-700
      dark:border-slate-600 dark:text-gray-300
    `,
    'outline-primary': `
      bg-transparent border border-purple-300 text-purple-700
      dark:border-purple-700 dark:text-purple-300
    `
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-0.5 text-xs',
    lg: 'px-3 py-1 text-sm'
  };

  const dotColors = {
    default: 'bg-gray-500',
    primary: 'bg-purple-500',
    secondary: 'bg-blue-500',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    error: 'bg-red-500',
    info: 'bg-blue-500'
  };

  return (
    <span
      ref={ref}
      className={`
        inline-flex items-center gap-1.5
        font-medium rounded-full
        ${variants[variant]}
        ${sizes[size]}
        ${className}
      `}
      {...props}
    >
      {dot && (
        <span className={`w-1.5 h-1.5 rounded-full ${dotColors[variant] || dotColors.default}`} />
      )}
      {children}
      {removable && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove?.();
          }}
          className="
            ml-0.5 -mr-1 p-0.5 rounded-full
            hover:bg-black/10 dark:hover:bg-white/10
            transition-colors
          "
          aria-label="Remove"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </span>
  );
});

Badge.displayName = 'Badge';

/**
 * Status Badge - Preset for status indicators
 */
const StatusBadge = forwardRef(({
  status = 'default',
  children,
  ...props
}, ref) => {
  const statusConfig = {
    online: { variant: 'success', dot: true, label: 'Online' },
    offline: { variant: 'default', dot: true, label: 'Offline' },
    away: { variant: 'warning', dot: true, label: 'Away' },
    busy: { variant: 'error', dot: true, label: 'Busy' },
    active: { variant: 'success', label: 'Active' },
    inactive: { variant: 'default', label: 'Inactive' },
    pending: { variant: 'warning', label: 'Pending' },
    completed: { variant: 'success', label: 'Completed' },
    failed: { variant: 'error', label: 'Failed' },
    draft: { variant: 'default', label: 'Draft' },
    published: { variant: 'primary', label: 'Published' },
    archived: { variant: 'default', label: 'Archived' }
  };

  const config = statusConfig[status] || { variant: 'default', label: status };

  return (
    <Badge
      ref={ref}
      variant={config.variant}
      dot={config.dot}
      {...props}
    >
      {children || config.label}
    </Badge>
  );
});

StatusBadge.displayName = 'StatusBadge';

/**
 * Notification Badge - For notification counts
 */
const NotificationBadge = forwardRef(({
  count = 0,
  max = 99,
  showZero = false,
  variant = 'error',
  size = 'sm',
  className = '',
  ...props
}, ref) => {
  if (count === 0 && !showZero) {
    return null;
  }

  const displayCount = count > max ? `${max}+` : count;

  return (
    <Badge
      ref={ref}
      variant={variant}
      size={size}
      className={`min-w-[1.25rem] justify-center ${className}`}
      {...props}
    >
      {displayCount}
    </Badge>
  );
});

NotificationBadge.displayName = 'NotificationBadge';

export { Badge, StatusBadge, NotificationBadge };
export default Badge;
