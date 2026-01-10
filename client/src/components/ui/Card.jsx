import { forwardRef } from 'react';
import { motion } from 'framer-motion';

/**
 * Card Component with variants, sizes, and hover animation
 * Follows BotBuilder Design System tokens
 */
const Card = forwardRef(({
  children,
  variant = 'default',
  size = 'md',
  hover = false,
  clickable = false,
  className = '',
  ...props
}, ref) => {
  const baseStyles = `
    rounded-xl transition-all duration-200
    border
  `;

  const variants = {
    default: `
      bg-white dark:bg-slate-800
      border-gray-200 dark:border-slate-700
      shadow-sm
    `,
    elevated: `
      bg-white dark:bg-slate-800
      border-transparent
      shadow-md hover:shadow-lg
    `,
    outlined: `
      bg-transparent
      border-gray-200 dark:border-slate-700
      shadow-none
    `,
    ghost: `
      bg-gray-50 dark:bg-slate-900
      border-transparent
      shadow-none
    `,
    gradient: `
      bg-gradient-to-br from-purple-50 to-indigo-50
      dark:from-purple-900/20 dark:to-indigo-900/20
      border-purple-100 dark:border-purple-800/30
      shadow-sm
    `,
    success: `
      bg-emerald-50 dark:bg-emerald-900/20
      border-emerald-200 dark:border-emerald-800/30
      shadow-sm
    `,
    warning: `
      bg-amber-50 dark:bg-amber-900/20
      border-amber-200 dark:border-amber-800/30
      shadow-sm
    `,
    error: `
      bg-red-50 dark:bg-red-900/20
      border-red-200 dark:border-red-800/30
      shadow-sm
    `,
    info: `
      bg-blue-50 dark:bg-blue-900/20
      border-blue-200 dark:border-blue-800/30
      shadow-sm
    `
  };

  const sizes = {
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8'
  };

  const hoverStyles = hover || clickable
    ? 'hover:shadow-lg hover:border-gray-300 dark:hover:border-slate-600 cursor-pointer'
    : '';

  const focusStyles = clickable
    ? 'focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900'
    : '';

  if (hover || clickable) {
    return (
      <motion.div
        ref={ref}
        className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${hoverStyles} ${focusStyles} ${className}`}
        whileHover={{ y: -2 }}
        whileTap={clickable ? { scale: 0.99 } : undefined}
        transition={{ duration: 0.15, ease: 'easeOut' }}
        tabIndex={clickable ? 0 : undefined}
        role={clickable ? 'button' : undefined}
        {...props}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <div
      ref={ref}
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
});

Card.displayName = 'Card';

/**
 * CardHeader Component
 */
const CardHeader = forwardRef(({
  children,
  className = '',
  actions,
  ...props
}, ref) => (
  <div
    ref={ref}
    className={`flex items-start justify-between gap-4 mb-4 ${className}`}
    {...props}
  >
    <div className="flex-1 min-w-0">
      {children}
    </div>
    {actions && (
      <div className="flex items-center gap-2 flex-shrink-0">
        {actions}
      </div>
    )}
  </div>
));

CardHeader.displayName = 'CardHeader';

/**
 * CardTitle Component
 */
const CardTitle = forwardRef(({
  children,
  className = '',
  size = 'md',
  as: Component = 'h3',
  ...props
}, ref) => {
  const sizes = {
    sm: 'text-base font-semibold',
    md: 'text-lg font-semibold',
    lg: 'text-xl font-bold',
    xl: 'text-2xl font-bold'
  };

  return (
    <Component
      ref={ref}
      className={`${sizes[size]} text-gray-900 dark:text-white leading-tight ${className}`}
      {...props}
    >
      {children}
    </Component>
  );
});

CardTitle.displayName = 'CardTitle';

/**
 * CardDescription Component
 */
const CardDescription = forwardRef(({
  children,
  className = '',
  ...props
}, ref) => (
  <p
    ref={ref}
    className={`text-sm text-gray-500 dark:text-gray-400 mt-1 leading-relaxed ${className}`}
    {...props}
  >
    {children}
  </p>
));

CardDescription.displayName = 'CardDescription';

/**
 * CardContent Component
 */
const CardContent = forwardRef(({
  children,
  className = '',
  ...props
}, ref) => (
  <div
    ref={ref}
    className={className}
    {...props}
  >
    {children}
  </div>
));

CardContent.displayName = 'CardContent';

/**
 * CardFooter Component
 */
const CardFooter = forwardRef(({
  children,
  className = '',
  border = true,
  justify = 'between',
  ...props
}, ref) => {
  const justifyStyles = {
    start: 'justify-start',
    center: 'justify-center',
    end: 'justify-end',
    between: 'justify-between'
  };

  return (
    <div
      ref={ref}
      className={`
        flex items-center gap-3 mt-4 pt-4
        ${border ? 'border-t border-gray-100 dark:border-slate-700' : ''}
        ${justifyStyles[justify]}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
});

CardFooter.displayName = 'CardFooter';

/**
 * CardBadge - Small badge for card status or label
 */
const CardBadge = forwardRef(({
  children,
  variant = 'default',
  className = '',
  ...props
}, ref) => {
  const variants = {
    default: 'bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-gray-300',
    primary: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    error: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    info: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
  };

  return (
    <span
      ref={ref}
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
});

CardBadge.displayName = 'CardBadge';

/**
 * CardDivider - Horizontal divider for card sections
 */
const CardDivider = forwardRef(({ className = '', ...props }, ref) => (
  <hr
    ref={ref}
    className={`my-4 border-t border-gray-100 dark:border-slate-700 ${className}`}
    {...props}
  />
));

CardDivider.displayName = 'CardDivider';

export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  CardBadge,
  CardDivider
};

export default Card;
