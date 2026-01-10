/**
 * ABTestVariant Component
 * Conditional rendering based on A/B test variant
 */

import React from 'react';
import { useABTest } from '../../../hooks/ab-tests/useABTest';

/**
 * Render different components based on variant
 *
 * @example
 * <ABTestVariant
 *   testId="test_123"
 *   variants={{
 *     A: () => <Button color="blue">Click Me</Button>,
 *     B: () => <Button color="green">Click Here!</Button>,
 *   }}
 *   fallback={<Button>Default</Button>}
 * />
 */
export function ABTestVariant({
  testId,
  variants,
  fallback = null,
  loadingComponent = null,
  onVariantSelected,
}) {
  const { variant, variantName, loading, error } = useABTest(testId);

  // Show loading state
  if (loading) {
    return loadingComponent;
  }

  // Show fallback on error or no variant
  if (error || !variant) {
    return fallback;
  }

  // Get the component for the variant
  const VariantComponent = variants[variantName];

  // Notify when variant is selected
  React.useEffect(() => {
    if (variantName && onVariantSelected) {
      onVariantSelected(variantName, variant);
    }
  }, [variantName]);

  // Render variant component or fallback
  if (VariantComponent) {
    return typeof VariantComponent === 'function'
      ? <VariantComponent variant={variant} />
      : VariantComponent;
  }

  return fallback;
}

/**
 * Render content only for specific variant
 *
 * @example
 * <ABTestShow testId="test_123" variant="B">
 *   <SpecialOffer />
 * </ABTestShow>
 */
export function ABTestShow({ testId, variant: targetVariant, children, fallback = null }) {
  const { variantName, loading } = useABTest(testId);

  if (loading) return null;

  if (variantName === targetVariant) {
    return children;
  }

  return fallback;
}

/**
 * Hide content for specific variant
 *
 * @example
 * <ABTestHide testId="test_123" variant="A">
 *   <NewFeature />
 * </ABTestHide>
 */
export function ABTestHide({ testId, variant: hideVariant, children }) {
  const { variantName, loading } = useABTest(testId);

  if (loading) return null;

  if (variantName === hideVariant) {
    return null;
  }

  return children;
}

/**
 * Wrapper that tracks impressions
 *
 * @example
 * <ABTestWrapper testId="test_123" trackImpression>
 *   <MyComponent />
 * </ABTestWrapper>
 */
export function ABTestWrapper({
  testId,
  children,
  trackImpression = false,
  className,
  style,
}) {
  const { variant, variantName, trackConversion } = useABTest(testId);
  const ref = React.useRef(null);
  const trackedRef = React.useRef(false);

  React.useEffect(() => {
    if (!trackImpression || trackedRef.current || !ref.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !trackedRef.current) {
            trackConversion('impression');
            trackedRef.current = true;
            observer.disconnect();
          }
        });
      },
      { threshold: 0.5 }
    );

    observer.observe(ref.current);

    return () => observer.disconnect();
  }, [trackImpression, trackConversion]);

  return (
    <div
      ref={ref}
      className={className}
      style={style}
      data-ab-test={testId}
      data-ab-variant={variantName}
    >
      {typeof children === 'function' ? children({ variant, variantName }) : children}
    </div>
  );
}

export default ABTestVariant;
