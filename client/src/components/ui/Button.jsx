import { forwardRef } from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

/**
 * Button Component with variants, sizes, and animations
 * Follows BotBuilder Design System tokens
 */
const Button = forwardRef(({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon: Icon,
  iconPosition = 'left',
  fullWidth = false,
  className = '',
  ...props
}, ref) => {
  const baseStyles = `
    inline-flex items-center justify-center gap-2 font-semibold
    transition-all duration-200 ease-out
    focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
    disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none
    select-none
  `;

  const variants = {
    primary: `
      bg-purple-600 text-white hover:bg-purple-700 active:bg-purple-800
      focus-visible:ring-purple-500 dark:focus-visible:ring-offset-slate-900
      shadow-sm hover:shadow-md hover:shadow-purple-500/20
    `,
    secondary: `
      bg-gray-100 text-gray-900 hover:bg-gray-200 active:bg-gray-300
      dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600 dark:active:bg-slate-500
      focus-visible:ring-gray-400 dark:focus-visible:ring-offset-slate-900
    `,
    outline: `
      border-2 border-purple-600 text-purple-600 bg-transparent
      hover:bg-purple-50 active:bg-purple-100
      dark:border-purple-400 dark:text-purple-400
      dark:hover:bg-purple-900/20 dark:active:bg-purple-900/30
      focus-visible:ring-purple-500 dark:focus-visible:ring-offset-slate-900
    `,
    ghost: `
      text-gray-700 bg-transparent hover:bg-gray-100 active:bg-gray-200
      dark:text-gray-300 dark:hover:bg-slate-700 dark:active:bg-slate-600
      focus-visible:ring-gray-400 dark:focus-visible:ring-offset-slate-900
    `,
    danger: `
      bg-red-600 text-white hover:bg-red-700 active:bg-red-800
      focus-visible:ring-red-500 dark:focus-visible:ring-offset-slate-900
      shadow-sm hover:shadow-md hover:shadow-red-500/20
    `,
    success: `
      bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800
      focus-visible:ring-emerald-500 dark:focus-visible:ring-offset-slate-900
      shadow-sm hover:shadow-md hover:shadow-emerald-500/20
    `,
    warning: `
      bg-amber-500 text-white hover:bg-amber-600 active:bg-amber-700
      focus-visible:ring-amber-500 dark:focus-visible:ring-offset-slate-900
      shadow-sm hover:shadow-md hover:shadow-amber-500/20
    `,
    gradient: `
      bg-gradient-to-r from-purple-600 to-indigo-600 text-white
      hover:from-purple-700 hover:to-indigo-700
      active:from-purple-800 active:to-indigo-800
      focus-visible:ring-purple-500 dark:focus-visible:ring-offset-slate-900
      shadow-sm hover:shadow-md hover:shadow-purple-500/25
    `,
    link: `
      text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300
      hover:underline underline-offset-4
      focus-visible:ring-purple-500 dark:focus-visible:ring-offset-slate-900
      p-0 h-auto
    `
  };

  const sizes = {
    xs: 'h-7 px-2.5 text-xs rounded-md gap-1.5',
    sm: 'h-8 px-3 text-sm rounded-lg gap-1.5',
    md: 'h-10 px-4 text-sm rounded-lg gap-2',
    lg: 'h-11 px-5 text-base rounded-lg gap-2',
    xl: 'h-12 px-6 text-base rounded-xl gap-2.5'
  };

  const iconSizes = {
    xs: 'w-3 h-3',
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
    xl: 'w-5 h-5'
  };

  const widthClass = fullWidth ? 'w-full' : '';

  return (
    <motion.button
      ref={ref}
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${widthClass} ${className}`}
      disabled={disabled || loading}
      whileHover={{ scale: disabled || loading ? 1 : 1.02 }}
      whileTap={{ scale: disabled || loading ? 1 : 0.98 }}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 className={`${iconSizes[size]} animate-spin`} />
          <span>Loading...</span>
        </>
      ) : (
        <>
          {Icon && iconPosition === 'left' && <Icon className={iconSizes[size]} />}
          {children}
          {Icon && iconPosition === 'right' && <Icon className={iconSizes[size]} />}
        </>
      )}
    </motion.button>
  );
});

Button.displayName = 'Button';

/**
 * IconButton - Button with only an icon
 */
const IconButton = forwardRef(({
  icon: Icon,
  variant = 'ghost',
  size = 'md',
  label,
  className = '',
  ...props
}, ref) => {
  const sizes = {
    xs: 'w-6 h-6',
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-11 h-11',
    xl: 'w-12 h-12'
  };

  const iconSizes = {
    xs: 'w-3 h-3',
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-5 h-5',
    xl: 'w-6 h-6'
  };

  const variantStyles = {
    primary: `
      bg-purple-600 text-white hover:bg-purple-700 active:bg-purple-800
      focus-visible:ring-purple-500 dark:focus-visible:ring-offset-slate-900
      shadow-sm
    `,
    secondary: `
      bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300
      dark:bg-slate-700 dark:text-gray-200 dark:hover:bg-slate-600
      focus-visible:ring-gray-400 dark:focus-visible:ring-offset-slate-900
    `,
    ghost: `
      text-gray-500 hover:text-gray-700 hover:bg-gray-100
      dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-slate-700
      focus-visible:ring-gray-400 dark:focus-visible:ring-offset-slate-900
    `,
    danger: `
      text-red-600 hover:bg-red-50 active:bg-red-100
      dark:text-red-400 dark:hover:bg-red-900/20
      focus-visible:ring-red-500 dark:focus-visible:ring-offset-slate-900
    `
  };

  return (
    <motion.button
      ref={ref}
      className={`
        inline-flex items-center justify-center rounded-lg
        transition-all duration-200 ease-out
        focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
        disabled:opacity-50 disabled:cursor-not-allowed
        ${sizes[size]} ${variantStyles[variant]} ${className}
      `}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      aria-label={label}
      {...props}
    >
      {Icon && <Icon className={iconSizes[size]} />}
    </motion.button>
  );
});

IconButton.displayName = 'IconButton';

/**
 * ButtonGroup - Group buttons together
 */
const ButtonGroup = forwardRef(({
  children,
  className = '',
  ...props
}, ref) => (
  <div
    ref={ref}
    className={`inline-flex rounded-lg shadow-sm ${className}`}
    role="group"
    {...props}
  >
    {children}
  </div>
));

ButtonGroup.displayName = 'ButtonGroup';

export { Button, IconButton, ButtonGroup };
export default Button;
