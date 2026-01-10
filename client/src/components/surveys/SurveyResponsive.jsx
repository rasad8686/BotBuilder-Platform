/**
 * Survey Responsive Components
 * Mobile-friendly and touch-optimized UI components
 */

import React, { useState, useRef, useEffect } from 'react';

// Responsive Container - adapts layout based on screen size
export const ResponsiveContainer = ({
  children,
  className = '',
  mobileClassName = '',
  desktopClassName = ''
}) => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <div className={`${className} ${isMobile ? mobileClassName : desktopClassName}`}>
      {children}
    </div>
  );
};

// Touch-friendly Button
export const TouchButton = ({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
  className = '',
  ...props
}) => {
  const [isPressed, setIsPressed] = useState(false);

  const variants = {
    primary: 'bg-indigo-600 hover:bg-indigo-700 text-white active:bg-indigo-800',
    secondary: 'bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 active:bg-gray-100 dark:active:bg-gray-600',
    success: 'bg-green-600 hover:bg-green-700 text-white active:bg-green-800',
    danger: 'bg-red-600 hover:bg-red-700 text-white active:bg-red-800',
    ghost: 'bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
  };

  const sizes = {
    sm: 'px-3 py-2 text-sm min-h-[36px]',
    md: 'px-4 py-3 text-base min-h-[44px]', // 44px is touch-friendly minimum
    lg: 'px-6 py-4 text-lg min-h-[52px]'
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      onTouchStart={() => setIsPressed(true)}
      onTouchEnd={() => setIsPressed(false)}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
      className={`
        relative inline-flex items-center justify-center font-medium rounded-lg
        transition-all duration-150 ease-out
        touch-manipulation select-none
        ${variants[variant]}
        ${sizes[size]}
        ${fullWidth ? 'w-full' : ''}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${isPressed ? 'scale-[0.98]' : 'scale-100'}
        ${className}
      `}
      {...props}
    >
      {loading && (
        <svg className="absolute animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      <span className={loading ? 'opacity-0' : ''}>{children}</span>
    </button>
  );
};

// Touch-friendly Rating Scale
export const TouchRatingScale = ({
  min = 0,
  max = 10,
  value,
  onChange,
  labels = {},
  disabled = false,
  className = ''
}) => {
  const values = Array.from({ length: max - min + 1 }, (_, i) => min + i);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Mobile: Scrollable horizontal */}
      <div className="flex gap-2 overflow-x-auto pb-2 snap-x snap-mandatory md:overflow-visible md:flex-wrap md:justify-center">
        {values.map((v) => (
          <button
            key={v}
            onClick={() => !disabled && onChange(v)}
            disabled={disabled}
            className={`
              flex-shrink-0 w-12 h-12 md:w-10 md:h-10
              rounded-lg font-medium text-lg
              transition-all duration-150
              touch-manipulation select-none
              snap-center
              ${value === v
                ? 'bg-indigo-600 text-white scale-110 shadow-lg'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-95'}
            `}
          >
            {v}
          </button>
        ))}
      </div>

      {/* Labels */}
      {(labels.min || labels.max) && (
        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 px-1">
          <span>{labels.min}</span>
          <span>{labels.max}</span>
        </div>
      )}
    </div>
  );
};

// Touch-friendly Star Rating
export const TouchStarRating = ({
  maxStars = 5,
  value = 0,
  onChange,
  size = 'lg',
  disabled = false,
  className = ''
}) => {
  const sizes = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-12 h-12' // Touch-friendly size
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {Array.from({ length: maxStars }).map((_, index) => (
        <button
          key={index}
          onClick={() => !disabled && onChange(index + 1)}
          disabled={disabled}
          className={`
            ${sizes[size]} transition-transform duration-150
            touch-manipulation select-none
            ${disabled ? 'cursor-not-allowed' : 'cursor-pointer active:scale-90'}
          `}
        >
          <svg
            className={`w-full h-full ${
              index < value
                ? 'text-yellow-400 fill-current'
                : 'text-gray-300 dark:text-gray-600'
            }`}
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
            />
          </svg>
        </button>
      ))}
    </div>
  );
};

// Touch-friendly Choice Option
export const TouchChoiceOption = ({
  label,
  selected,
  onClick,
  disabled = false,
  multiSelect = false,
  className = ''
}) => (
  <button
    onClick={() => !disabled && onClick()}
    disabled={disabled}
    className={`
      w-full p-4 rounded-lg border-2 text-left
      transition-all duration-150
      touch-manipulation select-none
      ${selected
        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20'
        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
      }
      ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-[0.99]'}
      ${className}
    `}
  >
    <div className="flex items-center gap-3">
      <div className={`
        flex-shrink-0 w-6 h-6 rounded-${multiSelect ? 'md' : 'full'}
        border-2 flex items-center justify-center
        transition-colors duration-150
        ${selected
          ? 'border-indigo-600 bg-indigo-600'
          : 'border-gray-300 dark:border-gray-600'
        }
      `}>
        {selected && (
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
      <span className={`text-base ${selected ? 'text-indigo-700 dark:text-indigo-300 font-medium' : 'text-gray-700 dark:text-gray-300'}`}>
        {label}
      </span>
    </div>
  </button>
);

// Touch-friendly Text Input
export const TouchTextInput = ({
  value,
  onChange,
  placeholder,
  multiline = false,
  disabled = false,
  maxLength,
  className = ''
}) => {
  const commonClasses = `
    w-full p-4 rounded-lg
    border-2 border-gray-200 dark:border-gray-700
    bg-white dark:bg-gray-800
    text-gray-900 dark:text-white
    placeholder-gray-400 dark:placeholder-gray-500
    focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20
    transition-colors duration-150
    text-base
    ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
    ${className}
  `;

  if (multiline) {
    return (
      <div className="relative">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          maxLength={maxLength}
          rows={4}
          className={`${commonClasses} resize-none`}
        />
        {maxLength && (
          <div className="absolute bottom-2 right-3 text-xs text-gray-400">
            {value?.length || 0}/{maxLength}
          </div>
        )}
      </div>
    );
  }

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      maxLength={maxLength}
      className={commonClasses}
    />
  );
};

// Swipeable Card (for mobile survey navigation)
export const SwipeableCard = ({
  children,
  onSwipeLeft,
  onSwipeRight,
  className = ''
}) => {
  const cardRef = useRef(null);
  const [startX, setStartX] = useState(0);
  const [currentX, setCurrentX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const handleTouchStart = (e) => {
    setStartX(e.touches[0].clientX);
    setIsDragging(true);
  };

  const handleTouchMove = (e) => {
    if (!isDragging) return;
    setCurrentX(e.touches[0].clientX - startX);
  };

  const handleTouchEnd = () => {
    if (Math.abs(currentX) > 100) {
      if (currentX > 0 && onSwipeRight) {
        onSwipeRight();
      } else if (currentX < 0 && onSwipeLeft) {
        onSwipeLeft();
      }
    }
    setCurrentX(0);
    setIsDragging(false);
  };

  return (
    <div
      ref={cardRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className={`touch-pan-y ${className}`}
      style={{
        transform: `translateX(${currentX}px)`,
        transition: isDragging ? 'none' : 'transform 0.3s ease-out'
      }}
    >
      {children}
    </div>
  );
};

// Mobile Bottom Sheet
export const MobileBottomSheet = ({
  isOpen,
  onClose,
  title,
  children,
  className = ''
}) => {
  const [startY, setStartY] = useState(0);
  const [currentY, setCurrentY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const handleTouchStart = (e) => {
    setStartY(e.touches[0].clientY);
    setIsDragging(true);
  };

  const handleTouchMove = (e) => {
    if (!isDragging) return;
    const diff = e.touches[0].clientY - startY;
    if (diff > 0) setCurrentY(diff);
  };

  const handleTouchEnd = () => {
    if (currentY > 100) {
      onClose();
    }
    setCurrentY(0);
    setIsDragging(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className={`absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-800 rounded-t-2xl max-h-[90vh] overflow-hidden ${className}`}
        style={{
          transform: `translateY(${currentY}px)`,
          transition: isDragging ? 'none' : 'transform 0.3s ease-out'
        }}
      >
        {/* Handle */}
        <div
          className="flex justify-center py-3 cursor-grab active:cursor-grabbing"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
        </div>

        {/* Title */}
        {title && (
          <div className="px-4 pb-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {title}
            </h3>
          </div>
        )}

        {/* Content */}
        <div className="overflow-y-auto p-4">
          {children}
        </div>
      </div>
    </div>
  );
};

// Responsive Grid
export const ResponsiveGrid = ({
  children,
  cols = { sm: 1, md: 2, lg: 3 },
  gap = 4,
  className = ''
}) => (
  <div
    className={`
      grid gap-${gap}
      grid-cols-${cols.sm}
      md:grid-cols-${cols.md}
      lg:grid-cols-${cols.lg}
      ${className}
    `}
  >
    {children}
  </div>
);

export default {
  ResponsiveContainer,
  TouchButton,
  TouchRatingScale,
  TouchStarRating,
  TouchChoiceOption,
  TouchTextInput,
  SwipeableCard,
  MobileBottomSheet,
  ResponsiveGrid
};
