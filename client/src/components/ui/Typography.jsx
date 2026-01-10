import { forwardRef } from 'react';

/**
 * Typography components for consistent text styling
 */

const H1 = forwardRef(({ children, className = '', ...props }, ref) => (
  <h1
    ref={ref}
    className={`text-4xl font-bold text-gray-900 dark:text-white tracking-tight ${className}`}
    {...props}
  >
    {children}
  </h1>
));
H1.displayName = 'H1';

const H2 = forwardRef(({ children, className = '', ...props }, ref) => (
  <h2
    ref={ref}
    className={`text-3xl font-bold text-gray-900 dark:text-white tracking-tight ${className}`}
    {...props}
  >
    {children}
  </h2>
));
H2.displayName = 'H2';

const H3 = forwardRef(({ children, className = '', ...props }, ref) => (
  <h3
    ref={ref}
    className={`text-2xl font-semibold text-gray-900 dark:text-white ${className}`}
    {...props}
  >
    {children}
  </h3>
));
H3.displayName = 'H3';

const H4 = forwardRef(({ children, className = '', ...props }, ref) => (
  <h4
    ref={ref}
    className={`text-xl font-semibold text-gray-900 dark:text-white ${className}`}
    {...props}
  >
    {children}
  </h4>
));
H4.displayName = 'H4';

const H5 = forwardRef(({ children, className = '', ...props }, ref) => (
  <h5
    ref={ref}
    className={`text-lg font-semibold text-gray-900 dark:text-white ${className}`}
    {...props}
  >
    {children}
  </h5>
));
H5.displayName = 'H5';

const H6 = forwardRef(({ children, className = '', ...props }, ref) => (
  <h6
    ref={ref}
    className={`text-base font-semibold text-gray-900 dark:text-white ${className}`}
    {...props}
  >
    {children}
  </h6>
));
H6.displayName = 'H6';

const Text = forwardRef(({
  children,
  className = '',
  size = 'base',
  muted = false,
  ...props
}, ref) => {
  const sizes = {
    xs: 'text-xs',
    sm: 'text-sm',
    base: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl'
  };

  const colorClass = muted
    ? 'text-gray-500 dark:text-gray-400'
    : 'text-gray-700 dark:text-gray-300';

  return (
    <p
      ref={ref}
      className={`${sizes[size]} ${colorClass} ${className}`}
      {...props}
    >
      {children}
    </p>
  );
});
Text.displayName = 'Text';

const Lead = forwardRef(({ children, className = '', ...props }, ref) => (
  <p
    ref={ref}
    className={`text-xl text-gray-600 dark:text-gray-400 leading-relaxed ${className}`}
    {...props}
  >
    {children}
  </p>
));
Lead.displayName = 'Lead';

const Small = forwardRef(({ children, className = '', muted = false, ...props }, ref) => {
  const colorClass = muted
    ? 'text-gray-500 dark:text-gray-400'
    : 'text-gray-700 dark:text-gray-300';

  return (
    <small
      ref={ref}
      className={`text-sm ${colorClass} ${className}`}
      {...props}
    >
      {children}
    </small>
  );
});
Small.displayName = 'Small';

const Label = forwardRef(({ children, className = '', required = false, ...props }, ref) => (
  <label
    ref={ref}
    className={`block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 ${className}`}
    {...props}
  >
    {children}
    {required && <span className="text-red-500 ml-1">*</span>}
  </label>
));
Label.displayName = 'Label';

export {
  H1,
  H2,
  H3,
  H4,
  H5,
  H6,
  Text,
  Lead,
  Small,
  Label
};
