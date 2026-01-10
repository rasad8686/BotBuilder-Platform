/**
 * DOM Utilities
 * Helper functions for DOM manipulation and element finding
 */

/**
 * Find an element by selector
 * @param {string} selector - CSS selector
 * @returns {Element|null}
 */
export function findElement(selector) {
  if (!selector) return null;

  try {
    // Handle special selectors
    if (selector.startsWith('data-tour=')) {
      const value = selector.replace('data-tour=', '');
      return document.querySelector(`[data-tour="${value}"]`);
    }

    if (selector.startsWith('data-tour-id=')) {
      const value = selector.replace('data-tour-id=', '');
      return document.querySelector(`[data-tour-id="${value}"]`);
    }

    return document.querySelector(selector);
  } catch (error) {
    console.error('[TourSDK] Invalid selector:', selector, error);
    return null;
  }
}

/**
 * Check if an element is visible in the viewport
 * @param {Element} element - DOM element
 * @returns {boolean}
 */
export function isElementVisible(element) {
  if (!element) return false;

  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);

  // Check if element has dimensions
  if (rect.width === 0 || rect.height === 0) return false;

  // Check CSS visibility
  if (style.display === 'none') return false;
  if (style.visibility === 'hidden') return false;
  if (parseFloat(style.opacity) === 0) return false;

  // Check if in viewport
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth;

  return (
    rect.top >= -rect.height &&
    rect.left >= -rect.width &&
    rect.bottom <= viewportHeight + rect.height &&
    rect.right <= viewportWidth + rect.width
  );
}

/**
 * Check if element is fully visible in viewport
 * @param {Element} element - DOM element
 * @returns {boolean}
 */
export function isElementFullyVisible(element) {
  if (!element) return false;

  const rect = element.getBoundingClientRect();
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth;

  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= viewportHeight &&
    rect.right <= viewportWidth
  );
}

/**
 * Get element position and dimensions
 * @param {Element} element - DOM element
 * @returns {Object}
 */
export function getElementPosition(element) {
  if (!element) return null;

  const rect = element.getBoundingClientRect();
  const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

  return {
    top: rect.top,
    left: rect.left,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
    absoluteTop: rect.top + scrollTop,
    absoluteLeft: rect.left + scrollLeft,
    centerX: rect.left + rect.width / 2,
    centerY: rect.top + rect.height / 2,
  };
}

/**
 * Scroll to an element
 * @param {Element} element - DOM element
 * @param {Object} options - Scroll options
 * @returns {Promise}
 */
export function scrollToElement(element, options = {}) {
  return new Promise((resolve) => {
    if (!element) {
      resolve();
      return;
    }

    const {
      behavior = 'smooth',
      block = 'center',
      inline = 'nearest',
      offset = 0,
    } = options;

    // Check if element is already visible
    if (isElementFullyVisible(element)) {
      resolve();
      return;
    }

    // Use native scrollIntoView
    element.scrollIntoView({
      behavior,
      block,
      inline,
    });

    // Apply additional offset if needed
    if (offset !== 0) {
      setTimeout(() => {
        window.scrollBy({
          top: offset,
          behavior: 'smooth',
        });
      }, 100);
    }

    // Wait for scroll to complete
    const scrollTimeout = behavior === 'smooth' ? 500 : 100;
    setTimeout(resolve, scrollTimeout);
  });
}

/**
 * Wait for an element to appear in the DOM
 * @param {string} selector - CSS selector
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<Element|null>}
 */
export function waitForElement(selector, timeout = 5000) {
  return new Promise((resolve) => {
    // Check if element already exists
    const existing = findElement(selector);
    if (existing) {
      resolve(existing);
      return;
    }

    const startTime = Date.now();

    // Use MutationObserver for better performance
    const observer = new MutationObserver((mutations, obs) => {
      const element = findElement(selector);
      if (element) {
        obs.disconnect();
        resolve(element);
      } else if (Date.now() - startTime >= timeout) {
        obs.disconnect();
        resolve(null);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
    });

    // Fallback timeout
    setTimeout(() => {
      observer.disconnect();
      resolve(findElement(selector));
    }, timeout);
  });
}

/**
 * Wait for element to be visible
 * @param {string} selector - CSS selector
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<Element|null>}
 */
export async function waitForElementVisible(selector, timeout = 5000) {
  const element = await waitForElement(selector, timeout);

  if (!element) return null;

  // Wait for visibility
  const startTime = Date.now();
  while (!isElementVisible(element) && Date.now() - startTime < timeout) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return isElementVisible(element) ? element : null;
}

/**
 * Add highlight effect to an element
 * @param {Element} element - DOM element
 * @param {Object} options - Highlight options
 * @returns {Function} - Cleanup function
 */
export function highlightElement(element, options = {}) {
  if (!element) return () => {};

  const {
    color = '#3B82F6',
    duration = 0, // 0 = permanent until cleanup
    pulse = false,
  } = options;

  const originalOutline = element.style.outline;
  const originalTransition = element.style.transition;

  element.style.outline = `3px solid ${color}`;
  element.style.transition = 'outline 0.3s ease';

  if (pulse) {
    element.classList.add('bbt-pulse-highlight');
  }

  const cleanup = () => {
    element.style.outline = originalOutline;
    element.style.transition = originalTransition;
    element.classList.remove('bbt-pulse-highlight');
  };

  if (duration > 0) {
    setTimeout(cleanup, duration);
  }

  return cleanup;
}

/**
 * Get all focusable elements within a container
 * @param {Element} container - Container element
 * @returns {Element[]}
 */
export function getFocusableElements(container) {
  const focusableSelectors = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ');

  return Array.from(container.querySelectorAll(focusableSelectors));
}

/**
 * Create focus trap within a container
 * @param {Element} container - Container element
 * @returns {Function} - Cleanup function
 */
export function createFocusTrap(container) {
  const focusableElements = getFocusableElements(container);
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

  container.addEventListener('keydown', handleKeyDown);
  firstElement?.focus();

  return () => {
    container.removeEventListener('keydown', handleKeyDown);
  };
}

/**
 * Get the z-index of an element
 * @param {Element} element - DOM element
 * @returns {number}
 */
export function getZIndex(element) {
  let el = element;
  let zIndex = 0;

  while (el) {
    const style = window.getComputedStyle(el);
    const z = parseInt(style.zIndex, 10);

    if (!isNaN(z) && z > zIndex) {
      zIndex = z;
    }

    el = el.parentElement;
  }

  return zIndex;
}
