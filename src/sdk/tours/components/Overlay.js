/**
 * Overlay Component
 * Creates a dark overlay with a spotlight on the target element
 */

export class Overlay {
  constructor(options) {
    this.options = {
      targetElement: null,
      onClick: null,
      padding: 8, // Padding around highlighted element
      opacity: 0.5,
      theme: 'light',
      borderRadius: 4,
      ...options,
    };

    this.element = null;
    this.spotlightElement = null;
    this._resizeHandler = null;
    this._scrollHandler = null;
  }

  render(container) {
    this._createOverlay();
    container.appendChild(this.element);

    this._updateSpotlight();
    this._setupListeners();
    this._animateIn();
  }

  destroy() {
    this._removeListeners();

    if (this.element) {
      this.element.classList.remove('bbt-overlay--enter');
      this.element.classList.add('bbt-overlay--exit');

      setTimeout(() => {
        if (this.element && this.element.parentNode) {
          this.element.parentNode.removeChild(this.element);
        }
      }, 200);
    }

    this.element = null;
    this.spotlightElement = null;
  }

  _createOverlay() {
    const { theme, opacity, onClick } = this.options;

    // SVG-based overlay for smooth spotlight cutout
    this.element = document.createElement('div');
    this.element.className = `bbt-overlay bbt-overlay--${theme}`;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'bbt-overlay__svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');

    // Defs for the mask
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');

    const mask = document.createElementNS('http://www.w3.org/2000/svg', 'mask');
    mask.setAttribute('id', 'bbt-spotlight-mask');

    // White rectangle (visible area)
    const maskRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    maskRect.setAttribute('x', '0');
    maskRect.setAttribute('y', '0');
    maskRect.setAttribute('width', '100%');
    maskRect.setAttribute('height', '100%');
    maskRect.setAttribute('fill', 'white');
    mask.appendChild(maskRect);

    // Black rectangle for spotlight (cutout)
    this.spotlightElement = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    this.spotlightElement.setAttribute('class', 'bbt-overlay__spotlight');
    this.spotlightElement.setAttribute('fill', 'black');
    this.spotlightElement.setAttribute('rx', this.options.borderRadius);
    this.spotlightElement.setAttribute('ry', this.options.borderRadius);
    mask.appendChild(this.spotlightElement);

    defs.appendChild(mask);
    svg.appendChild(defs);

    // Overlay rectangle with mask
    const overlayRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    overlayRect.setAttribute('x', '0');
    overlayRect.setAttribute('y', '0');
    overlayRect.setAttribute('width', '100%');
    overlayRect.setAttribute('height', '100%');
    overlayRect.setAttribute('fill', theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : `rgba(0, 0, 0, ${opacity})`);
    overlayRect.setAttribute('mask', 'url(#bbt-spotlight-mask)');
    svg.appendChild(overlayRect);

    this.element.appendChild(svg);

    // Click handler
    if (onClick) {
      this.element.onclick = (e) => {
        if (e.target === this.element || e.target.tagName === 'svg' || e.target.tagName === 'rect') {
          onClick();
        }
      };
    }
  }

  _updateSpotlight() {
    const { targetElement, padding } = this.options;

    if (!targetElement || !this.spotlightElement) {
      // Hide spotlight if no target
      this.spotlightElement.setAttribute('width', '0');
      this.spotlightElement.setAttribute('height', '0');
      return;
    }

    const rect = targetElement.getBoundingClientRect();

    this.spotlightElement.setAttribute('x', rect.left - padding);
    this.spotlightElement.setAttribute('y', rect.top - padding);
    this.spotlightElement.setAttribute('width', rect.width + padding * 2);
    this.spotlightElement.setAttribute('height', rect.height + padding * 2);
  }

  _setupListeners() {
    this._resizeHandler = () => this._updateSpotlight();
    this._scrollHandler = () => this._updateSpotlight();

    window.addEventListener('resize', this._resizeHandler);
    window.addEventListener('scroll', this._scrollHandler, true);
  }

  _removeListeners() {
    if (this._resizeHandler) {
      window.removeEventListener('resize', this._resizeHandler);
    }
    if (this._scrollHandler) {
      window.removeEventListener('scroll', this._scrollHandler, true);
    }
  }

  _animateIn() {
    requestAnimationFrame(() => {
      this.element.classList.add('bbt-overlay--enter');
    });
  }
}

/**
 * Simple highlight border around element (alternative to overlay)
 */
export class Highlight {
  constructor(options) {
    this.options = {
      targetElement: null,
      color: '#3B82F6',
      borderWidth: 2,
      padding: 4,
      borderRadius: 4,
      pulse: false,
      ...options,
    };

    this.element = null;
    this._resizeHandler = null;
    this._scrollHandler = null;
  }

  render(container) {
    this._createHighlight();
    container.appendChild(this.element);

    this._updatePosition();
    this._setupListeners();
    this._animateIn();
  }

  destroy() {
    this._removeListeners();

    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }

    this.element = null;
  }

  _createHighlight() {
    const { color, borderWidth, borderRadius, pulse } = this.options;

    this.element = document.createElement('div');
    this.element.className = 'bbt-highlight';

    if (pulse) {
      this.element.classList.add('bbt-highlight--pulse');
    }

    this.element.style.border = `${borderWidth}px solid ${color}`;
    this.element.style.borderRadius = `${borderRadius}px`;
    this.element.style.boxShadow = `0 0 0 4px ${color}33`;
  }

  _updatePosition() {
    const { targetElement, padding, borderWidth } = this.options;

    if (!targetElement) return;

    const rect = targetElement.getBoundingClientRect();

    this.element.style.position = 'fixed';
    this.element.style.top = `${rect.top - padding - borderWidth}px`;
    this.element.style.left = `${rect.left - padding - borderWidth}px`;
    this.element.style.width = `${rect.width + padding * 2}px`;
    this.element.style.height = `${rect.height + padding * 2}px`;
  }

  _setupListeners() {
    this._resizeHandler = () => this._updatePosition();
    this._scrollHandler = () => this._updatePosition();

    window.addEventListener('resize', this._resizeHandler);
    window.addEventListener('scroll', this._scrollHandler, true);
  }

  _removeListeners() {
    if (this._resizeHandler) {
      window.removeEventListener('resize', this._resizeHandler);
    }
    if (this._scrollHandler) {
      window.removeEventListener('scroll', this._scrollHandler, true);
    }
  }

  _animateIn() {
    requestAnimationFrame(() => {
      this.element.classList.add('bbt-highlight--enter');
    });
  }
}
