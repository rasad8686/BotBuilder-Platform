/**
 * ABTestButton Component
 * A/B tested button with automatic conversion tracking
 */

import React, { forwardRef } from 'react';
import { useABTestVariant } from '../../../hooks/ab-tests/useABTest';

/**
 * A/B Tested Button Component
 *
 * @example
 * <ABTestButton
 *   testId="cta_button_test"
 *   onClick={() => handleSignup()}
 * >
 *   Sign Up
 * </ABTestButton>
 */
export const ABTestButton = forwardRef(function ABTestButton(
  {
    testId,
    children,
    onClick,
    trackClick = true,
    trackHover = false,
    className = '',
    style = {},
    disabled = false,
    type = 'button',
    ...props
  },
  ref
) {
  const { content, variantName, loading, trackConversion } = useABTestVariant(
    testId,
    {
      text: null,
      color: null,
      size: null,
      style: {},
    }
  );

  const handleClick = async (e) => {
    if (trackClick && testId) {
      await trackConversion('click');
    }
    onClick?.(e);
  };

  const handleMouseEnter = async () => {
    if (trackHover && testId) {
      await trackConversion('hover');
    }
  };

  // Merge styles from variant content
  const buttonStyle = {
    ...style,
    ...(content.style || {}),
    ...(content.color && { backgroundColor: content.color }),
  };

  // Build class name
  const buttonClassName = [
    'ab-test-button',
    className,
    content.size && `ab-test-button--${content.size}`,
    variantName && `ab-test-button--${variantName.toLowerCase()}`,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      ref={ref}
      type={type}
      className={buttonClassName}
      style={buttonStyle}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      disabled={disabled || loading}
      data-ab-test={testId}
      data-ab-variant={variantName}
      {...props}
    >
      {content.text || children}
    </button>
  );
});

/**
 * A/B Tested Link Button
 */
export const ABTestLinkButton = forwardRef(function ABTestLinkButton(
  {
    testId,
    children,
    href,
    onClick,
    trackClick = true,
    target,
    rel,
    className = '',
    style = {},
    ...props
  },
  ref
) {
  const { content, variantName, trackConversion } = useABTestVariant(
    testId,
    {
      text: null,
      href: null,
      style: {},
    }
  );

  const handleClick = async (e) => {
    if (trackClick && testId) {
      await trackConversion('click');
    }
    onClick?.(e);
  };

  const linkStyle = {
    ...style,
    ...(content.style || {}),
  };

  return (
    <a
      ref={ref}
      href={content.href || href}
      target={target}
      rel={rel || (target === '_blank' ? 'noopener noreferrer' : undefined)}
      className={`ab-test-link ${className}`}
      style={linkStyle}
      onClick={handleClick}
      data-ab-test={testId}
      data-ab-variant={variantName}
      {...props}
    >
      {content.text || children}
    </a>
  );
});

/**
 * A/B Tested CTA (Call to Action) Component
 */
export function ABTestCTA({
  testId,
  children,
  onClick,
  trackClick = true,
  primary = true,
  size = 'medium',
  fullWidth = false,
  className = '',
  ...props
}) {
  const { content, variantName, trackConversion } = useABTestVariant(
    testId,
    {
      text: null,
      subtext: null,
      icon: null,
      color: null,
    }
  );

  const handleClick = async (e) => {
    if (trackClick && testId) {
      await trackConversion('cta_click');
    }
    onClick?.(e);
  };

  const ctaClassName = [
    'ab-test-cta',
    primary ? 'ab-test-cta--primary' : 'ab-test-cta--secondary',
    `ab-test-cta--${size}`,
    fullWidth && 'ab-test-cta--full-width',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const ctaStyle = content.color ? { backgroundColor: content.color } : {};

  return (
    <button
      className={ctaClassName}
      style={ctaStyle}
      onClick={handleClick}
      data-ab-test={testId}
      data-ab-variant={variantName}
      {...props}
    >
      {content.icon && <span className="ab-test-cta__icon">{content.icon}</span>}
      <span className="ab-test-cta__text">
        {content.text || children}
        {content.subtext && (
          <span className="ab-test-cta__subtext">{content.subtext}</span>
        )}
      </span>
    </button>
  );
}

export default ABTestButton;
