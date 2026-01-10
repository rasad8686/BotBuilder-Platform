/**
 * Hotspot Component
 * Displays a pulsing dot that reveals a tooltip on click/hover
 */

import { calculatePosition, adjustForViewport, getArrowPosition } from '../utils/positioning';

export class Hotspot {
  constructor(options) {
    this.options = {
      targetElement: null,
      title: '',
      content: '',
      position: 'right', // top, bottom, left, right
      color: null, // Custom color
      pulse: true,
      triggerOn: 'click', // click, hover
      stepIndex: 0,
      totalSteps: 1,
      showBackButton: false,
      showSkipButton: true,
      onNext: () => {},
      onPrev: () => {},
      onSkip: () => {},
      onClose: () => {},
      theme: 'light',
      primaryColor: null,
      ...options,
    };

    this.hotspotElement = null;
    this.tooltipElement = null;
    this.isTooltipVisible = false;
    this._resizeHandler = null;
    this._scrollHandler = null;
  }

  render(container) {
    this._createHotspot();
    this._createTooltip();

    container.appendChild(this.hotspotElement);
    container.appendChild(this.tooltipElement);

    this._positionHotspot();
    this._setupListeners();
    this._animateIn();
  }

  destroy() {
    this._removeListeners();

    if (this.hotspotElement) {
      this.hotspotElement.classList.add('bbt-hotspot--exit');
    }
    if (this.tooltipElement) {
      this.tooltipElement.classList.add('bbt-hotspot-tooltip--exit');
    }

    setTimeout(() => {
      if (this.hotspotElement && this.hotspotElement.parentNode) {
        this.hotspotElement.parentNode.removeChild(this.hotspotElement);
      }
      if (this.tooltipElement && this.tooltipElement.parentNode) {
        this.tooltipElement.parentNode.removeChild(this.tooltipElement);
      }
    }, 200);

    this.hotspotElement = null;
    this.tooltipElement = null;
  }

  _createHotspot() {
    const { color, pulse, theme, primaryColor } = this.options;

    this.hotspotElement = document.createElement('div');
    this.hotspotElement.className = `bbt-hotspot bbt-hotspot--${theme}`;

    if (pulse) {
      this.hotspotElement.classList.add('bbt-hotspot--pulse');
    }

    // Inner dot
    const dot = document.createElement('div');
    dot.className = 'bbt-hotspot__dot';

    if (color || primaryColor) {
      dot.style.backgroundColor = color || primaryColor;
    }

    // Pulse ring
    const ring = document.createElement('div');
    ring.className = 'bbt-hotspot__ring';

    if (color || primaryColor) {
      ring.style.borderColor = color || primaryColor;
    }

    this.hotspotElement.appendChild(dot);
    this.hotspotElement.appendChild(ring);
  }

  _createTooltip() {
    const {
      title,
      content,
      stepIndex,
      totalSteps,
      showBackButton,
      showSkipButton,
      theme,
      primaryColor,
    } = this.options;

    this.tooltipElement = document.createElement('div');
    this.tooltipElement.className = `bbt-hotspot-tooltip bbt-hotspot-tooltip--${theme}`;
    this.tooltipElement.style.display = 'none';

    if (primaryColor) {
      this.tooltipElement.style.setProperty('--bbt-primary-color', primaryColor);
    }

    // Arrow
    const arrow = document.createElement('div');
    arrow.className = 'bbt-hotspot-tooltip__arrow';
    this.tooltipElement.appendChild(arrow);

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'bbt-hotspot-tooltip__close';
    closeBtn.innerHTML = '&times;';
    closeBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.options.onClose();
    };
    this.tooltipElement.appendChild(closeBtn);

    // Content wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'bbt-hotspot-tooltip__wrapper';

    if (title) {
      const titleEl = document.createElement('h4');
      titleEl.className = 'bbt-hotspot-tooltip__title';
      titleEl.textContent = title;
      wrapper.appendChild(titleEl);
    }

    if (content) {
      const contentEl = document.createElement('div');
      contentEl.className = 'bbt-hotspot-tooltip__content';
      contentEl.innerHTML = content;
      wrapper.appendChild(contentEl);
    }

    // Footer
    const footer = document.createElement('div');
    footer.className = 'bbt-hotspot-tooltip__footer';

    if (totalSteps > 1) {
      const progress = document.createElement('span');
      progress.className = 'bbt-hotspot-tooltip__progress';
      progress.textContent = `${stepIndex + 1} / ${totalSteps}`;
      footer.appendChild(progress);
    }

    const actions = document.createElement('div');
    actions.className = 'bbt-hotspot-tooltip__actions';

    if (showSkipButton && stepIndex < totalSteps - 1) {
      const skipBtn = document.createElement('button');
      skipBtn.className = 'bbt-btn bbt-btn--text bbt-btn--sm';
      skipBtn.textContent = 'Skip';
      skipBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.options.onSkip();
      };
      actions.appendChild(skipBtn);
    }

    if (showBackButton) {
      const backBtn = document.createElement('button');
      backBtn.className = 'bbt-btn bbt-btn--secondary bbt-btn--sm';
      backBtn.textContent = 'Back';
      backBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.options.onPrev();
      };
      actions.appendChild(backBtn);
    }

    const nextBtn = document.createElement('button');
    nextBtn.className = 'bbt-btn bbt-btn--primary bbt-btn--sm';
    nextBtn.textContent = stepIndex >= totalSteps - 1 ? 'Done' : 'Next';
    nextBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.options.onNext();
    };
    actions.appendChild(nextBtn);

    footer.appendChild(actions);
    wrapper.appendChild(footer);
    this.tooltipElement.appendChild(wrapper);
  }

  _positionHotspot() {
    const { targetElement, position } = this.options;

    if (!targetElement) return;

    const targetRect = targetElement.getBoundingClientRect();

    // Position hotspot relative to target element
    let top, left;

    switch (position) {
      case 'top':
        top = targetRect.top - 12;
        left = targetRect.left + targetRect.width / 2;
        break;
      case 'bottom':
        top = targetRect.bottom + 12;
        left = targetRect.left + targetRect.width / 2;
        break;
      case 'left':
        top = targetRect.top + targetRect.height / 2;
        left = targetRect.left - 12;
        break;
      case 'right':
      default:
        top = targetRect.top + targetRect.height / 2;
        left = targetRect.right + 12;
        break;
    }

    this.hotspotElement.style.position = 'fixed';
    this.hotspotElement.style.top = `${top}px`;
    this.hotspotElement.style.left = `${left}px`;
  }

  _positionTooltip() {
    if (!this.isTooltipVisible) return;

    const hotspotRect = this.hotspotElement.getBoundingClientRect();
    const tooltipRect = this.tooltipElement.getBoundingClientRect();

    // Position tooltip relative to hotspot
    const { top, left, actualPosition } = calculatePosition(
      hotspotRect,
      tooltipRect,
      this.options.position === 'right' ? 'right' : 'bottom'
    );

    const adjusted = adjustForViewport(
      { top, left },
      { width: tooltipRect.width, height: tooltipRect.height }
    );

    this.tooltipElement.style.position = 'fixed';
    this.tooltipElement.style.top = `${adjusted.top}px`;
    this.tooltipElement.style.left = `${adjusted.left}px`;

    // Update arrow position
    const arrow = this.tooltipElement.querySelector('.bbt-hotspot-tooltip__arrow');
    if (arrow) {
      arrow.className = `bbt-hotspot-tooltip__arrow bbt-hotspot-tooltip__arrow--${getArrowPosition(actualPosition)}`;
    }
  }

  _showTooltip() {
    if (this.isTooltipVisible) return;

    this.isTooltipVisible = true;
    this.tooltipElement.style.display = 'block';

    requestAnimationFrame(() => {
      this._positionTooltip();
      this.tooltipElement.classList.add('bbt-hotspot-tooltip--enter');
    });
  }

  _hideTooltip() {
    if (!this.isTooltipVisible) return;

    this.isTooltipVisible = false;
    this.tooltipElement.classList.remove('bbt-hotspot-tooltip--enter');
    this.tooltipElement.classList.add('bbt-hotspot-tooltip--exit');

    setTimeout(() => {
      this.tooltipElement.style.display = 'none';
      this.tooltipElement.classList.remove('bbt-hotspot-tooltip--exit');
    }, 200);
  }

  _toggleTooltip() {
    if (this.isTooltipVisible) {
      this._hideTooltip();
    } else {
      this._showTooltip();
    }
  }

  _setupListeners() {
    const { triggerOn } = this.options;

    // Hotspot click/hover
    if (triggerOn === 'click') {
      this.hotspotElement.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this._toggleTooltip();
      };
    } else if (triggerOn === 'hover') {
      this.hotspotElement.onmouseenter = () => this._showTooltip();
      this.hotspotElement.onmouseleave = () => {
        // Delay to allow moving to tooltip
        setTimeout(() => {
          if (!this.tooltipElement.matches(':hover')) {
            this._hideTooltip();
          }
        }, 100);
      };
      this.tooltipElement.onmouseleave = () => this._hideTooltip();
    }

    // Reposition on resize/scroll
    this._resizeHandler = () => {
      this._positionHotspot();
      this._positionTooltip();
    };
    this._scrollHandler = () => {
      this._positionHotspot();
      this._positionTooltip();
    };

    window.addEventListener('resize', this._resizeHandler);
    window.addEventListener('scroll', this._scrollHandler, true);

    // Click outside to close
    this._clickOutsideHandler = (e) => {
      if (
        this.isTooltipVisible &&
        !this.tooltipElement.contains(e.target) &&
        !this.hotspotElement.contains(e.target)
      ) {
        this._hideTooltip();
      }
    };
    document.addEventListener('click', this._clickOutsideHandler);

    // Keyboard
    this._keyHandler = (e) => {
      if (e.key === 'Escape') {
        if (this.isTooltipVisible) {
          this._hideTooltip();
        } else {
          this.options.onClose();
        }
      }
    };
    document.addEventListener('keydown', this._keyHandler);

    // Auto-show tooltip after animation
    setTimeout(() => {
      this._showTooltip();
    }, 500);
  }

  _removeListeners() {
    if (this._resizeHandler) {
      window.removeEventListener('resize', this._resizeHandler);
    }
    if (this._scrollHandler) {
      window.removeEventListener('scroll', this._scrollHandler, true);
    }
    if (this._clickOutsideHandler) {
      document.removeEventListener('click', this._clickOutsideHandler);
    }
    if (this._keyHandler) {
      document.removeEventListener('keydown', this._keyHandler);
    }
  }

  _animateIn() {
    requestAnimationFrame(() => {
      this.hotspotElement.classList.add('bbt-hotspot--enter');
    });
  }
}
