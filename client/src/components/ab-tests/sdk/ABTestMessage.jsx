/**
 * ABTestMessage Component
 * A/B tested text and message components
 */

import React from 'react';
import { useABTestVariant, useABTestImpression } from '../../../hooks/ab-tests/useABTest';

/**
 * A/B Tested Message Component
 *
 * @example
 * <ABTestMessage
 *   testId="welcome_message_test"
 *   defaultMessage="Welcome to our platform!"
 * />
 */
export function ABTestMessage({
  testId,
  defaultMessage,
  as: Component = 'span',
  className = '',
  style = {},
  trackImpression = false,
  ...props
}) {
  const { content, variantName, loading, trackConversion } = useABTestVariant(
    testId,
    { message: defaultMessage }
  );

  const { ref } = useABTestImpression(trackImpression ? testId : null);

  if (loading) {
    return (
      <Component className={`ab-test-message ab-test-message--loading ${className}`} style={style}>
        {defaultMessage}
      </Component>
    );
  }

  return (
    <Component
      ref={trackImpression ? ref : undefined}
      className={`ab-test-message ${className}`}
      style={{ ...style, ...(content.style || {}) }}
      data-ab-test={testId}
      data-ab-variant={variantName}
      {...props}
    >
      {content.message || defaultMessage}
    </Component>
  );
}

/**
 * A/B Tested Heading Component
 *
 * @example
 * <ABTestHeading
 *   testId="hero_heading_test"
 *   level={1}
 *   defaultText="Build Amazing Products"
 * />
 */
export function ABTestHeading({
  testId,
  level = 2,
  defaultText,
  className = '',
  style = {},
  ...props
}) {
  const { content, variantName } = useABTestVariant(
    testId,
    { text: defaultText, style: {} }
  );

  const HeadingTag = `h${Math.min(Math.max(level, 1), 6)}`;

  return (
    <HeadingTag
      className={`ab-test-heading ${className}`}
      style={{ ...style, ...(content.style || {}) }}
      data-ab-test={testId}
      data-ab-variant={variantName}
      {...props}
    >
      {content.text || defaultText}
    </HeadingTag>
  );
}

/**
 * A/B Tested Paragraph Component
 */
export function ABTestParagraph({
  testId,
  defaultText,
  className = '',
  style = {},
  ...props
}) {
  const { content, variantName } = useABTestVariant(
    testId,
    { text: defaultText }
  );

  return (
    <p
      className={`ab-test-paragraph ${className}`}
      style={style}
      data-ab-test={testId}
      data-ab-variant={variantName}
      {...props}
    >
      {content.text || defaultText}
    </p>
  );
}

/**
 * A/B Tested Hero Section
 *
 * @example
 * <ABTestHero
 *   testId="hero_test"
 *   defaults={{
 *     title: "Welcome",
 *     subtitle: "Start your journey",
 *     ctaText: "Get Started"
 *   }}
 *   onCtaClick={() => navigate('/signup')}
 * />
 */
export function ABTestHero({
  testId,
  defaults = {},
  onCtaClick,
  className = '',
  style = {},
}) {
  const { content, variantName, trackConversion } = useABTestVariant(
    testId,
    {
      title: defaults.title || 'Welcome',
      subtitle: defaults.subtitle || '',
      ctaText: defaults.ctaText || 'Get Started',
      ctaColor: defaults.ctaColor || null,
      backgroundImage: defaults.backgroundImage || null,
    }
  );

  const handleCtaClick = async () => {
    await trackConversion('cta_click');
    onCtaClick?.();
  };

  const heroStyle = {
    ...style,
    ...(content.backgroundImage && {
      backgroundImage: `url(${content.backgroundImage})`,
    }),
  };

  return (
    <section
      className={`ab-test-hero ${className}`}
      style={heroStyle}
      data-ab-test={testId}
      data-ab-variant={variantName}
    >
      <h1 className="ab-test-hero__title">{content.title}</h1>
      {content.subtitle && (
        <p className="ab-test-hero__subtitle">{content.subtitle}</p>
      )}
      <button
        className="ab-test-hero__cta"
        style={content.ctaColor ? { backgroundColor: content.ctaColor } : {}}
        onClick={handleCtaClick}
      >
        {content.ctaText}
      </button>
    </section>
  );
}

/**
 * A/B Tested Banner Component
 */
export function ABTestBanner({
  testId,
  defaultMessage,
  type = 'info', // info, success, warning, promo
  dismissible = false,
  onDismiss,
  className = '',
  ...props
}) {
  const [dismissed, setDismissed] = React.useState(false);
  const { content, variantName, trackConversion } = useABTestVariant(
    testId,
    {
      message: defaultMessage,
      type,
      linkText: null,
      linkUrl: null,
    }
  );

  const handleDismiss = async () => {
    await trackConversion('banner_dismiss');
    setDismissed(true);
    onDismiss?.();
  };

  const handleLinkClick = async () => {
    await trackConversion('banner_click');
  };

  if (dismissed) return null;

  return (
    <div
      className={`ab-test-banner ab-test-banner--${content.type || type} ${className}`}
      data-ab-test={testId}
      data-ab-variant={variantName}
      {...props}
    >
      <span className="ab-test-banner__message">
        {content.message || defaultMessage}
      </span>
      {content.linkText && content.linkUrl && (
        <a
          href={content.linkUrl}
          className="ab-test-banner__link"
          onClick={handleLinkClick}
        >
          {content.linkText}
        </a>
      )}
      {dismissible && (
        <button
          className="ab-test-banner__dismiss"
          onClick={handleDismiss}
          aria-label="Dismiss"
        >
          &times;
        </button>
      )}
    </div>
  );
}

/**
 * A/B Tested Price Display
 */
export function ABTestPrice({
  testId,
  defaultPrice,
  currency = '$',
  period,
  className = '',
}) {
  const { content, variantName } = useABTestVariant(
    testId,
    {
      price: defaultPrice,
      currency,
      period,
      originalPrice: null,
      discount: null,
    }
  );

  const displayPrice = content.price ?? defaultPrice;
  const displayCurrency = content.currency || currency;
  const displayPeriod = content.period || period;

  return (
    <div
      className={`ab-test-price ${className}`}
      data-ab-test={testId}
      data-ab-variant={variantName}
    >
      {content.originalPrice && (
        <span className="ab-test-price__original">
          {displayCurrency}{content.originalPrice}
        </span>
      )}
      <span className="ab-test-price__current">
        {displayCurrency}{displayPrice}
      </span>
      {displayPeriod && (
        <span className="ab-test-price__period">/{displayPeriod}</span>
      )}
      {content.discount && (
        <span className="ab-test-price__discount">{content.discount}</span>
      )}
    </div>
  );
}

export default ABTestMessage;
