/**
 * @fileoverview Banner Display component for showing in-app banners
 * @module components/banners/BannerDisplay
 */

import { useState, useEffect } from 'react';
import {
  Info as InformationCircleIcon,
  AlertTriangle as ExclamationTriangleIcon,
  CheckCircle as CheckCircleIcon,
  XCircle as XCircleIcon,
  Sparkles as SparklesIcon,
  X as XMarkIcon
} from 'lucide-react';
import useBanners from '../../hooks/useBanners';

/**
 * Get icon component based on banner type
 * @param {string} type - Banner type
 * @returns {JSX.Element} Icon component
 */
const getBannerIcon = (type) => {
  const iconClass = 'w-5 h-5 flex-shrink-0';

  switch (type) {
    case 'info':
      return <InformationCircleIcon className={iconClass} />;
    case 'warning':
      return <ExclamationTriangleIcon className={iconClass} />;
    case 'success':
      return <CheckCircleIcon className={iconClass} />;
    case 'error':
      return <XCircleIcon className={iconClass} />;
    case 'promo':
      return <SparklesIcon className={iconClass} />;
    default:
      return <InformationCircleIcon className={iconClass} />;
  }
};

/**
 * Get banner styles based on type
 * @param {string} type - Banner type
 * @param {string} customColor - Custom background color (optional)
 * @returns {Object} Style classes
 */
const getBannerStyles = (type, customColor) => {
  if (customColor) {
    return {
      container: 'border',
      bg: customColor,
      text: 'text-white',
      border: 'border-transparent'
    };
  }

  switch (type) {
    case 'info':
      return {
        container: 'bg-blue-50 dark:bg-blue-900/30',
        text: 'text-blue-800 dark:text-blue-200',
        border: 'border-blue-200 dark:border-blue-700',
        icon: 'text-blue-500 dark:text-blue-400',
        button: 'bg-blue-600 hover:bg-blue-700 text-white',
        close: 'text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300'
      };
    case 'warning':
      return {
        container: 'bg-yellow-50 dark:bg-yellow-900/30',
        text: 'text-yellow-800 dark:text-yellow-200',
        border: 'border-yellow-200 dark:border-yellow-700',
        icon: 'text-yellow-500 dark:text-yellow-400',
        button: 'bg-yellow-600 hover:bg-yellow-700 text-white',
        close: 'text-yellow-500 hover:text-yellow-700 dark:text-yellow-400 dark:hover:text-yellow-300'
      };
    case 'success':
      return {
        container: 'bg-green-50 dark:bg-green-900/30',
        text: 'text-green-800 dark:text-green-200',
        border: 'border-green-200 dark:border-green-700',
        icon: 'text-green-500 dark:text-green-400',
        button: 'bg-green-600 hover:bg-green-700 text-white',
        close: 'text-green-500 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300'
      };
    case 'error':
      return {
        container: 'bg-red-50 dark:bg-red-900/30',
        text: 'text-red-800 dark:text-red-200',
        border: 'border-red-200 dark:border-red-700',
        icon: 'text-red-500 dark:text-red-400',
        button: 'bg-red-600 hover:bg-red-700 text-white',
        close: 'text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300'
      };
    case 'promo':
      return {
        container: 'bg-purple-50 dark:bg-purple-900/30',
        text: 'text-purple-800 dark:text-purple-200',
        border: 'border-purple-200 dark:border-purple-700',
        icon: 'text-purple-500 dark:text-purple-400',
        button: 'bg-purple-600 hover:bg-purple-700 text-white',
        close: 'text-purple-500 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300'
      };
    default:
      return {
        container: 'bg-gray-50 dark:bg-gray-900/30',
        text: 'text-gray-800 dark:text-gray-200',
        border: 'border-gray-200 dark:border-gray-700',
        icon: 'text-gray-500 dark:text-gray-400',
        button: 'bg-gray-600 hover:bg-gray-700 text-white',
        close: 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
      };
  }
};

/**
 * Get appropriate ARIA role based on banner type
 * @param {string} type - Banner type
 * @returns {string} ARIA role
 */
const getBannerRole = (type) => {
  switch (type) {
    case 'error':
    case 'warning':
      return 'alert'; // Immediate attention needed
    default:
      return 'status'; // Informational
  }
};

/**
 * Get appropriate aria-live value based on banner type
 * @param {string} type - Banner type
 * @returns {string} aria-live value
 */
const getBannerAriaLive = (type) => {
  switch (type) {
    case 'error':
      return 'assertive'; // Announce immediately
    case 'warning':
      return 'polite';
    default:
      return 'polite';
  }
};

/**
 * Single Banner Item component
 */
const BannerItem = ({ banner, onDismiss }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const styles = getBannerStyles(banner.type, banner.custom_color || banner.customColor);
  const bannerId = `banner-${banner.id}`;
  const bannerRole = getBannerRole(banner.type);
  const ariaLive = getBannerAriaLive(banner.type);

  // Animate in on mount
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => {
      onDismiss(banner.id);
    }, 300);
  };

  // Handle keyboard events for dismiss
  const handleKeyDown = (e) => {
    if (e.key === 'Escape' && (banner.dismissible !== false && banner.is_dismissible !== false)) {
      handleDismiss();
    }
  };

  const customStyle = (banner.custom_color || banner.customColor)
    ? { backgroundColor: banner.custom_color || banner.customColor }
    : {};

  return (
    <div
      id={bannerId}
      className={`
        border rounded-lg transition-all duration-300 ease-out
        ${styles.container} ${styles.border}
        ${isVisible && !isExiting ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}
        ${isExiting ? 'opacity-0 scale-95' : ''}
        focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-purple-500
      `}
      style={customStyle}
      role={bannerRole}
      aria-live={ariaLive}
      aria-atomic="true"
      aria-labelledby={`${bannerId}-title`}
      aria-describedby={`${bannerId}-message`}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div className="px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Left side: Icon + Content */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* Icon */}
            <span className={styles.icon}>
              {getBannerIcon(banner.type)}
            </span>

            {/* Title and Message */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 min-w-0 flex-1">
              {banner.title && (
                <span
                  id={`${bannerId}-title`}
                  className={`font-semibold ${styles.text} whitespace-nowrap`}
                >
                  {banner.title}:
                </span>
              )}
              <span
                id={`${bannerId}-message`}
                className={`${styles.text} text-sm truncate sm:text-base`}
              >
                {banner.message}
              </span>
            </div>
          </div>

          {/* Right side: Link Button + Close */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Link Button */}
            {(banner.link_url || banner.linkUrl) && (
              <a
                href={banner.link_url || banner.linkUrl}
                target={banner.link_target || banner.linkTarget || '_self'}
                rel={banner.link_target === '_blank' || banner.linkTarget === '_blank' ? 'noopener noreferrer' : undefined}
                className={`
                  px-3 py-1 text-sm font-medium rounded-md transition-colors
                  ${styles.button}
                  whitespace-nowrap
                `}
              >
                {banner.link_text || banner.linkText || 'Learn More'}
              </a>
            )}

            {/* Dismiss Button */}
            {(banner.dismissible !== false && banner.is_dismissible !== false) && (
              <button
                onClick={handleDismiss}
                className={`
                  p-1 rounded-md transition-colors
                  ${styles.close}
                  hover:bg-black/10 dark:hover:bg-white/10
                `}
                aria-label="Dismiss banner"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Network Error Banner component
 * Shows when banners fail to load with retry option
 */
const NetworkErrorBanner = ({ onRetry, isRetrying }) => {
  return (
    <div
      className="border rounded-lg bg-gray-50 dark:bg-gray-900/30 border-gray-200 dark:border-gray-700"
      role="alert"
      aria-live="polite"
    >
      <div className="px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <XCircleIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            <span className="text-gray-600 dark:text-gray-300 text-sm">
              Failed to load notifications
            </span>
          </div>
          <button
            onClick={onRetry}
            disabled={isRetrying}
            className="px-3 py-1 text-sm font-medium rounded-md bg-gray-600 hover:bg-gray-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Retry loading notifications"
          >
            {isRetrying ? 'Retrying...' : 'Retry'}
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Banner Display container component
 * Shows all active banners stacked
 */
const BannerDisplay = ({ showNetworkError = false }) => {
  const { banners, loading, networkError, dismissBanner, retryFetch } = useBanners();

  // Show network error if enabled and there's an error
  if (showNetworkError && networkError && (!banners || banners.length === 0)) {
    return <NetworkErrorBanner onRetry={retryFetch} isRetrying={loading} />;
  }

  // Don't render anything if no banners
  if (!banners || banners.length === 0) {
    return null;
  }

  return (
    <section
      className="space-y-2"
      role="region"
      aria-label="Notifications and announcements"
      aria-live="polite"
    >
      {/* Screen reader announcement for banner count */}
      <div className="sr-only" aria-live="polite">
        {banners.length} {banners.length === 1 ? 'notification' : 'notifications'} available
      </div>

      {banners.map((banner, index) => (
        <BannerItem
          key={banner.id}
          banner={banner}
          onDismiss={dismissBanner}
        />
      ))}
    </section>
  );
};

export default BannerDisplay;
