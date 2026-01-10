/**
 * Survey Accessibility Components
 * Keyboard navigation, screen reader support, and focus management
 */

import React, { useRef, useEffect, useCallback, useState } from 'react';

// Focus Trap - keeps focus within a container
export const FocusTrap = ({ children, active = true, className = '' }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!active) return;

    const container = containerRef.current;
    if (!container) return;

    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleKeyDown = (e) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    // Focus first element when trap activates
    firstElement?.focus();

    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [active]);

  return (
    <div ref={containerRef} className={className}>
      {children}
    </div>
  );
};

// Skip Link for keyboard users
export const SkipLink = ({ targetId, children = 'Skip to main content' }) => (
  <a
    href={`#${targetId}`}
    className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-indigo-600 focus:text-white focus:rounded-lg focus:outline-none"
  >
    {children}
  </a>
);

// Visually Hidden (for screen readers only)
export const VisuallyHidden = ({ children, as: Component = 'span' }) => (
  <Component className="sr-only">{children}</Component>
);

// Live Region for announcements
export const LiveRegion = ({ message, priority = 'polite' }) => (
  <div
    role="status"
    aria-live={priority}
    aria-atomic="true"
    className="sr-only"
  >
    {message}
  </div>
);

// Accessible Progress Indicator
export const AccessibleProgress = ({
  current,
  total,
  label = 'Survey progress',
  className = ''
}) => {
  const percentage = Math.round((current / total) * 100);

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {label}
        </span>
        <span className="text-sm font-medium text-gray-900 dark:text-white">
          {current} of {total}
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={percentage}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label}: ${percentage}% complete`}
        className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden"
      >
        <div
          className="h-full bg-indigo-600 rounded-full transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <VisuallyHidden>
        {percentage}% complete, question {current} of {total}
      </VisuallyHidden>
    </div>
  );
};

// Accessible Rating Scale with keyboard support
export const AccessibleRatingScale = ({
  min = 0,
  max = 10,
  value,
  onChange,
  label,
  minLabel,
  maxLabel,
  disabled = false,
  className = ''
}) => {
  const groupRef = useRef(null);

  const handleKeyDown = useCallback((e) => {
    if (disabled) return;

    let newValue = value;

    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        e.preventDefault();
        newValue = Math.min(max, (value ?? min - 1) + 1);
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        e.preventDefault();
        newValue = Math.max(min, (value ?? min + 1) - 1);
        break;
      case 'Home':
        e.preventDefault();
        newValue = min;
        break;
      case 'End':
        e.preventDefault();
        newValue = max;
        break;
      default:
        return;
    }

    onChange(newValue);
  }, [value, min, max, onChange, disabled]);

  const values = Array.from({ length: max - min + 1 }, (_, i) => min + i);

  return (
    <div className={className}>
      {label && (
        <label id="rating-label" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          {label}
        </label>
      )}
      <div
        ref={groupRef}
        role="radiogroup"
        aria-labelledby={label ? 'rating-label' : undefined}
        onKeyDown={handleKeyDown}
        className="flex flex-wrap gap-2"
      >
        {values.map((v) => (
          <button
            key={v}
            role="radio"
            aria-checked={value === v}
            tabIndex={value === v ? 0 : -1}
            onClick={() => !disabled && onChange(v)}
            disabled={disabled}
            className={`
              w-10 h-10 rounded-lg font-medium
              transition-all duration-150
              focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
              ${value === v
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            {v}
          </button>
        ))}
      </div>
      {(minLabel || maxLabel) && (
        <div className="flex justify-between mt-2 text-xs text-gray-500 dark:text-gray-400">
          <span>{minLabel}</span>
          <span>{maxLabel}</span>
        </div>
      )}
      <VisuallyHidden>
        {value !== null && value !== undefined
          ? `Selected rating: ${value} out of ${max}`
          : 'No rating selected'}
      </VisuallyHidden>
    </div>
  );
};

// Accessible Choice Group
export const AccessibleChoiceGroup = ({
  options,
  value,
  onChange,
  label,
  multiSelect = false,
  disabled = false,
  className = ''
}) => {
  const groupRef = useRef(null);
  const [focusIndex, setFocusIndex] = useState(0);

  const handleKeyDown = useCallback((e) => {
    if (disabled) return;

    let newIndex = focusIndex;

    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        e.preventDefault();
        newIndex = (focusIndex + 1) % options.length;
        break;
      case 'ArrowUp':
      case 'ArrowLeft':
        e.preventDefault();
        newIndex = (focusIndex - 1 + options.length) % options.length;
        break;
      case ' ':
      case 'Enter':
        e.preventDefault();
        const option = options[focusIndex];
        if (multiSelect) {
          const isSelected = (value || []).includes(option.value);
          onChange(
            isSelected
              ? (value || []).filter(v => v !== option.value)
              : [...(value || []), option.value]
          );
        } else {
          onChange(option.value);
        }
        break;
      default:
        return;
    }

    setFocusIndex(newIndex);
    const buttons = groupRef.current?.querySelectorAll('[role="radio"], [role="checkbox"]');
    buttons?.[newIndex]?.focus();
  }, [focusIndex, options, value, onChange, multiSelect, disabled]);

  const isSelected = (optionValue) => {
    if (multiSelect) {
      return (value || []).includes(optionValue);
    }
    return value === optionValue;
  };

  return (
    <div className={className}>
      {label && (
        <label id="choice-group-label" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          {label}
        </label>
      )}
      <div
        ref={groupRef}
        role={multiSelect ? 'group' : 'radiogroup'}
        aria-labelledby={label ? 'choice-group-label' : undefined}
        onKeyDown={handleKeyDown}
        className="space-y-2"
      >
        {options.map((option, index) => (
          <button
            key={option.value}
            role={multiSelect ? 'checkbox' : 'radio'}
            aria-checked={isSelected(option.value)}
            tabIndex={focusIndex === index ? 0 : -1}
            onClick={() => {
              if (disabled) return;
              setFocusIndex(index);
              if (multiSelect) {
                const selected = isSelected(option.value);
                onChange(
                  selected
                    ? (value || []).filter(v => v !== option.value)
                    : [...(value || []), option.value]
                );
              } else {
                onChange(option.value);
              }
            }}
            disabled={disabled}
            className={`
              w-full p-4 rounded-lg border-2 text-left
              transition-all duration-150
              focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
              ${isSelected(option.value)
                ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            <div className="flex items-center gap-3">
              <div className={`
                flex-shrink-0 w-5 h-5 rounded-${multiSelect ? 'md' : 'full'}
                border-2 flex items-center justify-center
                ${isSelected(option.value)
                  ? 'border-indigo-600 bg-indigo-600'
                  : 'border-gray-300 dark:border-gray-600'
                }
              `}>
                {isSelected(option.value) && (
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <span className="text-gray-700 dark:text-gray-300">{option.label}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

// Accessible Modal
export const AccessibleModal = ({
  isOpen,
  onClose,
  title,
  children,
  className = ''
}) => {
  const modalRef = useRef(null);
  const previousFocus = useRef(null);

  useEffect(() => {
    if (isOpen) {
      previousFocus.current = document.activeElement;
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      previousFocus.current?.focus();
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onKeyDown={handleKeyDown}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <FocusTrap active={isOpen}>
        <div
          ref={modalRef}
          className={`relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-auto ${className}`}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 id="modal-title" className="text-lg font-semibold text-gray-900 dark:text-white">
              {title}
            </h2>
            <button
              onClick={onClose}
              aria-label="Close modal"
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="p-4">
            {children}
          </div>
        </div>
      </FocusTrap>
    </div>
  );
};

// Keyboard Shortcut Handler
export const useKeyboardShortcuts = (shortcuts) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      const key = [
        e.ctrlKey && 'ctrl',
        e.shiftKey && 'shift',
        e.altKey && 'alt',
        e.key.toLowerCase()
      ].filter(Boolean).join('+');

      const shortcut = shortcuts[key];
      if (shortcut) {
        e.preventDefault();
        shortcut();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
};

// Focus Indicator Component
export const FocusRing = ({ children, className = '' }) => (
  <div className={`focus-within:ring-2 focus-within:ring-indigo-500 focus-within:ring-offset-2 rounded-lg ${className}`}>
    {children}
  </div>
);

export default {
  FocusTrap,
  SkipLink,
  VisuallyHidden,
  LiveRegion,
  AccessibleProgress,
  AccessibleRatingScale,
  AccessibleChoiceGroup,
  AccessibleModal,
  useKeyboardShortcuts,
  FocusRing
};
