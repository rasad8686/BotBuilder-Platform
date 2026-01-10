import { forwardRef, useState } from 'react';
import { Eye, EyeOff, Search, X, AlertCircle, CheckCircle } from 'lucide-react';

/**
 * Input Component with variants, sizes, and states
 * Follows BotBuilder Design System tokens
 */
const Input = forwardRef(({
  type = 'text',
  size = 'md',
  variant = 'default',
  error = false,
  success = false,
  disabled = false,
  label,
  helperText,
  errorMessage,
  successMessage,
  leftIcon: LeftIcon,
  rightIcon: RightIcon,
  clearable = false,
  showPasswordToggle = false,
  className = '',
  inputClassName = '',
  onClear,
  ...props
}, ref) => {
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const baseInputStyles = `
    w-full transition-all duration-200
    bg-white dark:bg-slate-800
    text-gray-900 dark:text-white
    placeholder:text-gray-400 dark:placeholder:text-gray-500
    border rounded-lg
    focus:outline-none focus:ring-2 focus:ring-offset-0
    disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50 dark:disabled:bg-slate-900
  `;

  const sizes = {
    sm: 'h-8 px-3 text-sm',
    md: 'h-10 px-4 text-sm',
    lg: 'h-12 px-4 text-base'
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  };

  const getStateStyles = () => {
    if (error) {
      return `
        border-red-500 dark:border-red-400
        focus:border-red-500 focus:ring-red-500/20
      `;
    }
    if (success) {
      return `
        border-emerald-500 dark:border-emerald-400
        focus:border-emerald-500 focus:ring-emerald-500/20
      `;
    }
    return `
      border-gray-300 dark:border-slate-600
      hover:border-gray-400 dark:hover:border-slate-500
      focus:border-purple-500 dark:focus:border-purple-400
      focus:ring-purple-500/20
    `;
  };

  const inputType = type === 'password' && showPassword ? 'text' : type;

  const hasRightElement = clearable || showPasswordToggle || RightIcon || error || success;
  const paddingRight = hasRightElement ? 'pr-10' : '';
  const paddingLeft = LeftIcon ? 'pl-10' : '';

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          {label}
        </label>
      )}

      <div className="relative">
        {/* Left Icon */}
        {LeftIcon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none">
            <LeftIcon className={iconSizes[size]} />
          </div>
        )}

        {/* Input */}
        <input
          ref={ref}
          type={inputType}
          disabled={disabled}
          onFocus={(e) => {
            setIsFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            props.onBlur?.(e);
          }}
          className={`
            ${baseInputStyles}
            ${sizes[size]}
            ${getStateStyles()}
            ${paddingLeft}
            ${paddingRight}
            ${inputClassName}
          `}
          {...props}
        />

        {/* Right Elements Container */}
        {hasRightElement && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {/* Clear Button */}
            {clearable && props.value && !disabled && (
              <button
                type="button"
                onClick={() => onClear?.()}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                aria-label="Clear input"
              >
                <X className={iconSizes[size]} />
              </button>
            )}

            {/* Password Toggle */}
            {type === 'password' && showPasswordToggle && (
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff className={iconSizes[size]} />
                ) : (
                  <Eye className={iconSizes[size]} />
                )}
              </button>
            )}

            {/* Status Icon */}
            {error && !clearable && (
              <AlertCircle className={`${iconSizes[size]} text-red-500`} />
            )}
            {success && !clearable && (
              <CheckCircle className={`${iconSizes[size]} text-emerald-500`} />
            )}

            {/* Custom Right Icon */}
            {RightIcon && !error && !success && !clearable && (
              <RightIcon className={`${iconSizes[size]} text-gray-400`} />
            )}
          </div>
        )}
      </div>

      {/* Helper Text / Error Message / Success Message */}
      {(helperText || errorMessage || successMessage) && (
        <p className={`mt-1.5 text-sm ${
          errorMessage ? 'text-red-500 dark:text-red-400' :
          successMessage ? 'text-emerald-600 dark:text-emerald-400' :
          'text-gray-500 dark:text-gray-400'
        }`}>
          {errorMessage || successMessage || helperText}
        </p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

/**
 * SearchInput - Specialized search input with icon
 */
const SearchInput = forwardRef(({
  placeholder = 'Search...',
  className = '',
  ...props
}, ref) => (
  <Input
    ref={ref}
    type="search"
    placeholder={placeholder}
    leftIcon={Search}
    clearable
    className={className}
    {...props}
  />
));

SearchInput.displayName = 'SearchInput';

/**
 * Textarea Component
 */
const Textarea = forwardRef(({
  size = 'md',
  error = false,
  success = false,
  disabled = false,
  label,
  helperText,
  errorMessage,
  successMessage,
  className = '',
  rows = 4,
  resize = 'vertical',
  ...props
}, ref) => {
  const baseStyles = `
    w-full transition-all duration-200
    bg-white dark:bg-slate-800
    text-gray-900 dark:text-white
    placeholder:text-gray-400 dark:placeholder:text-gray-500
    border rounded-lg
    focus:outline-none focus:ring-2 focus:ring-offset-0
    disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50 dark:disabled:bg-slate-900
  `;

  const sizes = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-4 py-3 text-base'
  };

  const resizeStyles = {
    none: 'resize-none',
    vertical: 'resize-y',
    horizontal: 'resize-x',
    both: 'resize'
  };

  const getStateStyles = () => {
    if (error) {
      return `
        border-red-500 dark:border-red-400
        focus:border-red-500 focus:ring-red-500/20
      `;
    }
    if (success) {
      return `
        border-emerald-500 dark:border-emerald-400
        focus:border-emerald-500 focus:ring-emerald-500/20
      `;
    }
    return `
      border-gray-300 dark:border-slate-600
      hover:border-gray-400 dark:hover:border-slate-500
      focus:border-purple-500 dark:focus:border-purple-400
      focus:ring-purple-500/20
    `;
  };

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          {label}
        </label>
      )}

      <textarea
        ref={ref}
        rows={rows}
        disabled={disabled}
        className={`
          ${baseStyles}
          ${sizes[size]}
          ${getStateStyles()}
          ${resizeStyles[resize]}
        `}
        {...props}
      />

      {(helperText || errorMessage || successMessage) && (
        <p className={`mt-1.5 text-sm ${
          errorMessage ? 'text-red-500 dark:text-red-400' :
          successMessage ? 'text-emerald-600 dark:text-emerald-400' :
          'text-gray-500 dark:text-gray-400'
        }`}>
          {errorMessage || successMessage || helperText}
        </p>
      )}
    </div>
  );
});

Textarea.displayName = 'Textarea';

/**
 * Select Component
 */
const Select = forwardRef(({
  size = 'md',
  error = false,
  disabled = false,
  label,
  helperText,
  errorMessage,
  placeholder = 'Select an option',
  options = [],
  className = '',
  ...props
}, ref) => {
  const baseStyles = `
    w-full transition-all duration-200
    bg-white dark:bg-slate-800
    text-gray-900 dark:text-white
    border rounded-lg
    focus:outline-none focus:ring-2 focus:ring-offset-0
    disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50 dark:disabled:bg-slate-900
    appearance-none cursor-pointer
  `;

  const sizes = {
    sm: 'h-8 px-3 pr-8 text-sm',
    md: 'h-10 px-4 pr-10 text-sm',
    lg: 'h-12 px-4 pr-10 text-base'
  };

  const getStateStyles = () => {
    if (error) {
      return `
        border-red-500 dark:border-red-400
        focus:border-red-500 focus:ring-red-500/20
      `;
    }
    return `
      border-gray-300 dark:border-slate-600
      hover:border-gray-400 dark:hover:border-slate-500
      focus:border-purple-500 dark:focus:border-purple-400
      focus:ring-purple-500/20
    `;
  };

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          {label}
        </label>
      )}

      <div className="relative">
        <select
          ref={ref}
          disabled={disabled}
          className={`
            ${baseStyles}
            ${sizes[size]}
            ${getStateStyles()}
          `}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </option>
          ))}
        </select>

        {/* Dropdown Arrow */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {(helperText || errorMessage) && (
        <p className={`mt-1.5 text-sm ${
          errorMessage ? 'text-red-500 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'
        }`}>
          {errorMessage || helperText}
        </p>
      )}
    </div>
  );
});

Select.displayName = 'Select';

/**
 * Checkbox Component
 */
const Checkbox = forwardRef(({
  label,
  description,
  error = false,
  disabled = false,
  size = 'md',
  className = '',
  ...props
}, ref) => {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };

  const labelSizes = {
    sm: 'text-sm',
    md: 'text-sm',
    lg: 'text-base'
  };

  return (
    <label className={`inline-flex items-start gap-3 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${className}`}>
      <input
        ref={ref}
        type="checkbox"
        disabled={disabled}
        className={`
          ${sizes[size]}
          rounded border-gray-300 dark:border-slate-600
          text-purple-600 dark:text-purple-500
          bg-white dark:bg-slate-800
          focus:ring-2 focus:ring-purple-500/20 focus:ring-offset-0
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-colors cursor-pointer
          ${error ? 'border-red-500' : ''}
        `}
        {...props}
      />
      {(label || description) && (
        <div className="flex flex-col">
          {label && (
            <span className={`${labelSizes[size]} font-medium text-gray-900 dark:text-white`}>
              {label}
            </span>
          )}
          {description && (
            <span className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {description}
            </span>
          )}
        </div>
      )}
    </label>
  );
});

Checkbox.displayName = 'Checkbox';

/**
 * Radio Component
 */
const Radio = forwardRef(({
  label,
  description,
  error = false,
  disabled = false,
  size = 'md',
  className = '',
  ...props
}, ref) => {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };

  const labelSizes = {
    sm: 'text-sm',
    md: 'text-sm',
    lg: 'text-base'
  };

  return (
    <label className={`inline-flex items-start gap-3 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${className}`}>
      <input
        ref={ref}
        type="radio"
        disabled={disabled}
        className={`
          ${sizes[size]}
          border-gray-300 dark:border-slate-600
          text-purple-600 dark:text-purple-500
          bg-white dark:bg-slate-800
          focus:ring-2 focus:ring-purple-500/20 focus:ring-offset-0
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-colors cursor-pointer
          ${error ? 'border-red-500' : ''}
        `}
        {...props}
      />
      {(label || description) && (
        <div className="flex flex-col">
          {label && (
            <span className={`${labelSizes[size]} font-medium text-gray-900 dark:text-white`}>
              {label}
            </span>
          )}
          {description && (
            <span className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {description}
            </span>
          )}
        </div>
      )}
    </label>
  );
});

Radio.displayName = 'Radio';

/**
 * Switch/Toggle Component
 */
const Switch = forwardRef(({
  label,
  description,
  disabled = false,
  size = 'md',
  className = '',
  checked = false,
  onChange,
  ...props
}, ref) => {
  const trackSizes = {
    sm: 'w-8 h-4',
    md: 'w-11 h-6',
    lg: 'w-14 h-7'
  };

  const thumbSizes = {
    sm: 'w-3 h-3',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };

  const translateSizes = {
    sm: 'translate-x-4',
    md: 'translate-x-5',
    lg: 'translate-x-7'
  };

  const labelSizes = {
    sm: 'text-sm',
    md: 'text-sm',
    lg: 'text-base'
  };

  return (
    <label className={`inline-flex items-start gap-3 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${className}`}>
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange?.(!checked)}
        className={`
          ${trackSizes[size]}
          relative inline-flex items-center shrink-0
          rounded-full transition-colors duration-200
          focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2
          disabled:cursor-not-allowed
          ${checked
            ? 'bg-purple-600 dark:bg-purple-500'
            : 'bg-gray-200 dark:bg-slate-700'
          }
        `}
        {...props}
      >
        <span
          className={`
            ${thumbSizes[size]}
            inline-block rounded-full bg-white shadow-sm
            transition-transform duration-200
            ${checked ? translateSizes[size] : 'translate-x-0.5'}
          `}
        />
      </button>
      {(label || description) && (
        <div className="flex flex-col">
          {label && (
            <span className={`${labelSizes[size]} font-medium text-gray-900 dark:text-white`}>
              {label}
            </span>
          )}
          {description && (
            <span className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {description}
            </span>
          )}
        </div>
      )}
    </label>
  );
});

Switch.displayName = 'Switch';

/**
 * InputGroup - Group inputs together
 */
const InputGroup = forwardRef(({
  children,
  className = '',
  ...props
}, ref) => (
  <div
    ref={ref}
    className={`flex items-center ${className}`}
    {...props}
  >
    {children}
  </div>
));

InputGroup.displayName = 'InputGroup';

/**
 * InputAddon - Addon for input groups
 */
const InputAddon = forwardRef(({
  children,
  position = 'left',
  className = '',
  ...props
}, ref) => {
  const positionStyles = {
    left: 'rounded-l-lg border-r-0',
    right: 'rounded-r-lg border-l-0'
  };

  return (
    <div
      ref={ref}
      className={`
        inline-flex items-center px-3
        bg-gray-50 dark:bg-slate-700
        border border-gray-300 dark:border-slate-600
        text-gray-500 dark:text-gray-400 text-sm
        ${positionStyles[position]}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
});

InputAddon.displayName = 'InputAddon';

export {
  Input,
  SearchInput,
  Textarea,
  Select,
  Checkbox,
  Radio,
  Switch,
  InputGroup,
  InputAddon
};

export default Input;
