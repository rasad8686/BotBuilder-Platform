/**
 * Positioning Utilities
 * Handles tooltip/modal positioning and viewport adjustments
 */

const ARROW_SIZE = 8;
const SPACING = 12;

/**
 * Calculate position for tooltip relative to target element
 * @param {DOMRect} targetRect - Target element bounding rect
 * @param {DOMRect} tooltipRect - Tooltip element bounding rect
 * @param {string} preferredPosition - Preferred position (top, bottom, left, right, auto)
 * @returns {Object} - { top, left, actualPosition }
 */
export function calculatePosition(targetRect, tooltipRect, preferredPosition = 'bottom') {
  const positions = {
    top: {
      top: targetRect.top - tooltipRect.height - SPACING,
      left: targetRect.left + targetRect.width / 2 - tooltipRect.width / 2,
    },
    bottom: {
      top: targetRect.bottom + SPACING,
      left: targetRect.left + targetRect.width / 2 - tooltipRect.width / 2,
    },
    left: {
      top: targetRect.top + targetRect.height / 2 - tooltipRect.height / 2,
      left: targetRect.left - tooltipRect.width - SPACING,
    },
    right: {
      top: targetRect.top + targetRect.height / 2 - tooltipRect.height / 2,
      left: targetRect.right + SPACING,
    },
  };

  // Auto position - find best fit
  if (preferredPosition === 'auto') {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Check which positions fit in viewport
    const fits = {
      top: positions.top.top >= 0,
      bottom: positions.bottom.top + tooltipRect.height <= viewportHeight,
      left: positions.left.left >= 0,
      right: positions.right.left + tooltipRect.width <= viewportWidth,
    };

    // Priority: bottom > top > right > left
    if (fits.bottom) preferredPosition = 'bottom';
    else if (fits.top) preferredPosition = 'top';
    else if (fits.right) preferredPosition = 'right';
    else if (fits.left) preferredPosition = 'left';
    else preferredPosition = 'bottom'; // Default fallback
  }

  const position = positions[preferredPosition] || positions.bottom;

  return {
    top: position.top,
    left: position.left,
    actualPosition: preferredPosition,
  };
}

/**
 * Adjust position to fit within viewport
 * @param {Object} position - { top, left }
 * @param {Object} dimensions - { width, height }
 * @returns {Object} - Adjusted { top, left }
 */
export function adjustForViewport(position, dimensions) {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const padding = 10; // Minimum distance from viewport edge

  let { top, left } = position;
  const { width, height } = dimensions;

  // Horizontal adjustment
  if (left < padding) {
    left = padding;
  } else if (left + width > viewportWidth - padding) {
    left = viewportWidth - width - padding;
  }

  // Vertical adjustment
  if (top < padding) {
    top = padding;
  } else if (top + height > viewportHeight - padding) {
    top = viewportHeight - height - padding;
  }

  return { top, left };
}

/**
 * Get arrow position class based on tooltip position
 * @param {string} position - Tooltip position (top, bottom, left, right)
 * @returns {string} - Arrow position class
 */
export function getArrowPosition(position) {
  // Arrow points opposite to tooltip position
  const arrowPositions = {
    top: 'bottom',
    bottom: 'top',
    left: 'right',
    right: 'left',
  };

  return arrowPositions[position] || 'top';
}

/**
 * Calculate arrow offset for centered alignment
 * @param {DOMRect} targetRect - Target element rect
 * @param {DOMRect} tooltipRect - Tooltip element rect
 * @param {string} position - Tooltip position
 * @returns {Object} - { offset, direction }
 */
export function calculateArrowOffset(targetRect, tooltipRect, position) {
  const tooltipCenter =
    position === 'top' || position === 'bottom'
      ? tooltipRect.left + tooltipRect.width / 2
      : tooltipRect.top + tooltipRect.height / 2;

  const targetCenter =
    position === 'top' || position === 'bottom'
      ? targetRect.left + targetRect.width / 2
      : targetRect.top + targetRect.height / 2;

  return {
    offset: targetCenter - tooltipCenter,
    direction: position === 'top' || position === 'bottom' ? 'horizontal' : 'vertical',
  };
}

/**
 * Get optimal position based on available space
 * @param {DOMRect} targetRect - Target element rect
 * @param {Object} tooltipSize - { width, height }
 * @returns {string} - Best position
 */
export function getOptimalPosition(targetRect, tooltipSize) {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  const spaceAbove = targetRect.top;
  const spaceBelow = viewportHeight - targetRect.bottom;
  const spaceLeft = targetRect.left;
  const spaceRight = viewportWidth - targetRect.right;

  const spaces = {
    top: { space: spaceAbove, fits: spaceAbove >= tooltipSize.height + SPACING },
    bottom: { space: spaceBelow, fits: spaceBelow >= tooltipSize.height + SPACING },
    left: { space: spaceLeft, fits: spaceLeft >= tooltipSize.width + SPACING },
    right: { space: spaceRight, fits: spaceRight >= tooltipSize.width + SPACING },
  };

  // Find positions that fit
  const fittingPositions = Object.entries(spaces)
    .filter(([, data]) => data.fits)
    .sort(([, a], [, b]) => b.space - a.space);

  if (fittingPositions.length > 0) {
    return fittingPositions[0][0];
  }

  // If nothing fits perfectly, return position with most space
  const allPositions = Object.entries(spaces).sort(([, a], [, b]) => b.space - a.space);

  return allPositions[0][0];
}

/**
 * Calculate position for modal dialog
 * @param {Object} modalSize - { width, height }
 * @param {string} alignment - 'center', 'top', 'bottom'
 * @returns {Object} - { top, left }
 */
export function calculateModalPosition(modalSize, alignment = 'center') {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  const left = (viewportWidth - modalSize.width) / 2;

  let top;
  switch (alignment) {
    case 'top':
      top = 60;
      break;
    case 'bottom':
      top = viewportHeight - modalSize.height - 60;
      break;
    case 'center':
    default:
      top = (viewportHeight - modalSize.height) / 2;
      break;
  }

  return { top, left };
}

/**
 * Calculate position for slideout panel
 * @param {number} width - Panel width
 * @param {string} side - 'left' or 'right'
 * @returns {Object} - CSS properties
 */
export function calculateSlideoutPosition(width, side = 'right') {
  return {
    top: 0,
    bottom: 0,
    [side]: 0,
    width: `${width}px`,
    [side === 'right' ? 'left' : 'right']: 'auto',
  };
}

/**
 * Check if position would cause overflow
 * @param {Object} position - { top, left }
 * @param {Object} dimensions - { width, height }
 * @returns {Object} - { overflowTop, overflowRight, overflowBottom, overflowLeft }
 */
export function checkOverflow(position, dimensions) {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  return {
    overflowTop: position.top < 0,
    overflowRight: position.left + dimensions.width > viewportWidth,
    overflowBottom: position.top + dimensions.height > viewportHeight,
    overflowLeft: position.left < 0,
  };
}

/**
 * Get centered position in viewport
 * @param {Object} dimensions - { width, height }
 * @returns {Object} - { top, left }
 */
export function getCenteredPosition(dimensions) {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  return {
    top: (viewportHeight - dimensions.height) / 2,
    left: (viewportWidth - dimensions.width) / 2,
  };
}
