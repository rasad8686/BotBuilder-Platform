/**
 * Tooltip Component
 * Displays a tooltip attached to a target element
 */

import { calculatePosition, adjustForViewport, getArrowPosition } from '../utils/positioning';

export class Tooltip {
  constructor(options) {
    this.options = {
      title: '',
      content: '',
      position: 'bottom', // top, bottom, left, right, auto
      targetElement: null,
      media: null, // { type: 'image'|'video', src: '...', alt: '...' }
      buttons: null, // Custom buttons
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

    this.element = null;
    this.arrowElement = null;
    this._resizeHandler = null;
    this._scrollHandler = null;
  }

  render(container) {
    this._createTooltip();
    container.appendChild(this.element);
    this._positionTooltip();
    this._setupListeners();
    this._animateIn();
  }

  destroy() {
    this._removeListeners();

    if (this.element && this.element.parentNode) {
      this.element.classList.add('bbt-tooltip--exit');
      setTimeout(() => {
        if (this.element && this.element.parentNode) {
          this.element.parentNode.removeChild(this.element);
        }
      }, 200);
    }

    this.element = null;
    this.arrowElement = null;
  }

  _createTooltip() {
    const {
      title,
      content,
      media,
      buttons,
      stepIndex,
      totalSteps,
      showBackButton,
      showSkipButton,
      theme,
      primaryColor,
    } = this.options;

    this.element = document.createElement('div');
    this.element.className = `bbt-tooltip bbt-tooltip--${theme}`;

    if (primaryColor) {
      this.element.style.setProperty('--bbt-primary-color', primaryColor);
    }

    // Arrow
    this.arrowElement = document.createElement('div');
    this.arrowElement.className = 'bbt-tooltip__arrow';
    this.element.appendChild(this.arrowElement);

    // Content wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'bbt-tooltip__wrapper';

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'bbt-tooltip__close';
    closeBtn.innerHTML = '&times;';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.onclick = (e) => {
      e.preventDefault();
      this.options.onClose();
    };
    wrapper.appendChild(closeBtn);

    // Media
    if (media) {
      const mediaEl = this._createMedia(media);
      wrapper.appendChild(mediaEl);
    }

    // Header with title
    if (title) {
      const header = document.createElement('div');
      header.className = 'bbt-tooltip__header';

      const titleEl = document.createElement('h4');
      titleEl.className = 'bbt-tooltip__title';
      titleEl.textContent = title;
      header.appendChild(titleEl);

      wrapper.appendChild(header);
    }

    // Content
    if (content) {
      const contentEl = document.createElement('div');
      contentEl.className = 'bbt-tooltip__content';
      contentEl.innerHTML = content;
      wrapper.appendChild(contentEl);
    }

    // Footer with actions
    const footer = document.createElement('div');
    footer.className = 'bbt-tooltip__footer';

    // Progress indicator
    if (totalSteps > 1) {
      const progress = document.createElement('span');
      progress.className = 'bbt-tooltip__progress';
      progress.textContent = `${stepIndex + 1} / ${totalSteps}`;
      footer.appendChild(progress);
    }

    // Actions
    const actions = document.createElement('div');
    actions.className = 'bbt-tooltip__actions';

    if (buttons) {
      // Custom buttons
      buttons.forEach((btn) => {
        const button = document.createElement('button');
        button.className = `bbt-btn bbt-btn--${btn.variant || 'secondary'}`;
        button.textContent = btn.text;
        button.onclick = (e) => {
          e.preventDefault();
          if (btn.action === 'next') this.options.onNext();
          else if (btn.action === 'prev') this.options.onPrev();
          else if (btn.action === 'skip') this.options.onSkip();
          else if (btn.action === 'close') this.options.onClose();
          else if (btn.onClick) btn.onClick();
        };
        actions.appendChild(button);
      });
    } else {
      // Default buttons
      if (showSkipButton && stepIndex < totalSteps - 1) {
        const skipBtn = document.createElement('button');
        skipBtn.className = 'bbt-btn bbt-btn--text';
        skipBtn.textContent = 'Skip';
        skipBtn.onclick = (e) => {
          e.preventDefault();
          this.options.onSkip();
        };
        actions.appendChild(skipBtn);
      }

      if (showBackButton) {
        const backBtn = document.createElement('button');
        backBtn.className = 'bbt-btn bbt-btn--secondary';
        backBtn.textContent = 'Back';
        backBtn.onclick = (e) => {
          e.preventDefault();
          this.options.onPrev();
        };
        actions.appendChild(backBtn);
      }

      const nextBtn = document.createElement('button');
      nextBtn.className = 'bbt-btn bbt-btn--primary';
      nextBtn.textContent = stepIndex >= totalSteps - 1 ? 'Done' : 'Next';
      nextBtn.onclick = (e) => {
        e.preventDefault();
        this.options.onNext();
      };
      actions.appendChild(nextBtn);
    }

    footer.appendChild(actions);
    wrapper.appendChild(footer);
    this.element.appendChild(wrapper);
  }

  _createMedia(media) {
    const container = document.createElement('div');
    container.className = 'bbt-tooltip__media';

    if (media.type === 'image') {
      const img = document.createElement('img');
      img.src = media.src;
      img.alt = media.alt || '';
      img.className = 'bbt-tooltip__image';
      container.appendChild(img);
    } else if (media.type === 'video') {
      const video = document.createElement('video');
      video.src = media.src;
      video.controls = true;
      video.autoplay = media.autoplay || false;
      video.muted = media.muted || true;
      video.loop = media.loop || false;
      video.className = 'bbt-tooltip__video';
      container.appendChild(video);
    } else if (media.type === 'embed') {
      const iframe = document.createElement('iframe');
      iframe.src = media.src;
      iframe.className = 'bbt-tooltip__embed';
      iframe.allowFullscreen = true;
      container.appendChild(iframe);
    }

    return container;
  }

  _positionTooltip() {
    const { targetElement, position } = this.options;

    if (!targetElement) {
      // Center in viewport if no target
      this.element.style.position = 'fixed';
      this.element.style.top = '50%';
      this.element.style.left = '50%';
      this.element.style.transform = 'translate(-50%, -50%)';
      this.arrowElement.style.display = 'none';
      return;
    }

    const targetRect = targetElement.getBoundingClientRect();
    const tooltipRect = this.element.getBoundingClientRect();

    const { top, left, actualPosition } = calculatePosition(
      targetRect,
      tooltipRect,
      position
    );

    const adjusted = adjustForViewport(
      { top, left },
      { width: tooltipRect.width, height: tooltipRect.height }
    );

    this.element.style.position = 'fixed';
    this.element.style.top = `${adjusted.top}px`;
    this.element.style.left = `${adjusted.left}px`;

    // Position arrow
    const arrowPosition = getArrowPosition(actualPosition);
    this.arrowElement.className = `bbt-tooltip__arrow bbt-tooltip__arrow--${arrowPosition}`;
  }

  _setupListeners() {
    // Reposition on resize and scroll
    this._resizeHandler = () => this._positionTooltip();
    this._scrollHandler = () => this._positionTooltip();

    window.addEventListener('resize', this._resizeHandler);
    window.addEventListener('scroll', this._scrollHandler, true);

    // Keyboard navigation
    this._keyHandler = (e) => {
      if (e.key === 'Escape') {
        this.options.onClose();
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        this.options.onNext();
      } else if (e.key === 'ArrowLeft') {
        this.options.onPrev();
      }
    };
    document.addEventListener('keydown', this._keyHandler);
  }

  _removeListeners() {
    if (this._resizeHandler) {
      window.removeEventListener('resize', this._resizeHandler);
    }
    if (this._scrollHandler) {
      window.removeEventListener('scroll', this._scrollHandler, true);
    }
    if (this._keyHandler) {
      document.removeEventListener('keydown', this._keyHandler);
    }
  }

  _animateIn() {
    requestAnimationFrame(() => {
      this.element.classList.add('bbt-tooltip--enter');
    });
  }
}
