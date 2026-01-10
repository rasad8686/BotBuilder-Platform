/**
 * Modal Component
 * Displays a centered modal dialog
 */

export class Modal {
  constructor(options) {
    this.options = {
      title: '',
      content: '',
      size: 'medium', // small, medium, large
      media: null,
      buttons: null,
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
      closeOnBackdrop: true,
      closeOnEscape: true,
      ...options,
    };

    this.element = null;
    this.backdropElement = null;
    this._keyHandler = null;
  }

  render(container) {
    this._createBackdrop();
    this._createModal();

    container.appendChild(this.backdropElement);
    container.appendChild(this.element);

    this._setupListeners();
    this._animateIn();

    // Focus trap
    this.element.focus();
  }

  destroy() {
    this._removeListeners();

    if (this.element) {
      this.element.classList.add('bbt-modal--exit');
    }
    if (this.backdropElement) {
      this.backdropElement.classList.add('bbt-modal-backdrop--exit');
    }

    setTimeout(() => {
      if (this.element && this.element.parentNode) {
        this.element.parentNode.removeChild(this.element);
      }
      if (this.backdropElement && this.backdropElement.parentNode) {
        this.backdropElement.parentNode.removeChild(this.backdropElement);
      }
    }, 200);

    this.element = null;
    this.backdropElement = null;
  }

  _createBackdrop() {
    this.backdropElement = document.createElement('div');
    this.backdropElement.className = `bbt-modal-backdrop bbt-modal-backdrop--${this.options.theme}`;

    if (this.options.closeOnBackdrop) {
      this.backdropElement.onclick = (e) => {
        if (e.target === this.backdropElement) {
          this.options.onClose();
        }
      };
    }
  }

  _createModal() {
    const {
      title,
      content,
      size,
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
    this.element.className = `bbt-modal bbt-modal--${size} bbt-modal--${theme}`;
    this.element.setAttribute('role', 'dialog');
    this.element.setAttribute('aria-modal', 'true');
    this.element.setAttribute('tabindex', '-1');

    if (primaryColor) {
      this.element.style.setProperty('--bbt-primary-color', primaryColor);
    }

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'bbt-modal__close';
    closeBtn.innerHTML = '&times;';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.onclick = (e) => {
      e.preventDefault();
      this.options.onClose();
    };
    this.element.appendChild(closeBtn);

    // Media
    if (media) {
      const mediaEl = this._createMedia(media);
      this.element.appendChild(mediaEl);
    }

    // Header
    if (title) {
      const header = document.createElement('div');
      header.className = 'bbt-modal__header';

      const titleEl = document.createElement('h3');
      titleEl.className = 'bbt-modal__title';
      titleEl.textContent = title;
      header.appendChild(titleEl);

      this.element.appendChild(header);
    }

    // Body
    if (content) {
      const body = document.createElement('div');
      body.className = 'bbt-modal__body';
      body.innerHTML = content;
      this.element.appendChild(body);
    }

    // Footer
    const footer = document.createElement('div');
    footer.className = 'bbt-modal__footer';

    // Progress
    if (totalSteps > 1) {
      const progress = document.createElement('div');
      progress.className = 'bbt-modal__progress';

      for (let i = 0; i < totalSteps; i++) {
        const dot = document.createElement('span');
        dot.className = `bbt-modal__progress-dot ${i === stepIndex ? 'bbt-modal__progress-dot--active' : ''} ${i < stepIndex ? 'bbt-modal__progress-dot--completed' : ''}`;
        progress.appendChild(dot);
      }

      footer.appendChild(progress);
    }

    // Actions
    const actions = document.createElement('div');
    actions.className = 'bbt-modal__actions';

    if (buttons) {
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
      if (showSkipButton && stepIndex < totalSteps - 1) {
        const skipBtn = document.createElement('button');
        skipBtn.className = 'bbt-btn bbt-btn--text';
        skipBtn.textContent = 'Skip tour';
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
      nextBtn.textContent = stepIndex >= totalSteps - 1 ? 'Get Started' : 'Next';
      nextBtn.onclick = (e) => {
        e.preventDefault();
        this.options.onNext();
      };
      actions.appendChild(nextBtn);
    }

    footer.appendChild(actions);
    this.element.appendChild(footer);
  }

  _createMedia(media) {
    const container = document.createElement('div');
    container.className = 'bbt-modal__media';

    if (media.type === 'image') {
      const img = document.createElement('img');
      img.src = media.src;
      img.alt = media.alt || '';
      img.className = 'bbt-modal__image';
      container.appendChild(img);
    } else if (media.type === 'video') {
      const video = document.createElement('video');
      video.src = media.src;
      video.controls = true;
      video.autoplay = media.autoplay || false;
      video.muted = media.muted !== false;
      video.loop = media.loop || false;
      video.className = 'bbt-modal__video';
      container.appendChild(video);
    } else if (media.type === 'embed') {
      const iframe = document.createElement('iframe');
      iframe.src = media.src;
      iframe.className = 'bbt-modal__embed';
      iframe.allowFullscreen = true;
      container.appendChild(iframe);
    } else if (media.type === 'lottie') {
      const lottieContainer = document.createElement('div');
      lottieContainer.className = 'bbt-modal__lottie';
      lottieContainer.setAttribute('data-lottie-src', media.src);
      container.appendChild(lottieContainer);
    }

    return container;
  }

  _setupListeners() {
    if (this.options.closeOnEscape) {
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
  }

  _removeListeners() {
    if (this._keyHandler) {
      document.removeEventListener('keydown', this._keyHandler);
    }
  }

  _animateIn() {
    requestAnimationFrame(() => {
      this.backdropElement.classList.add('bbt-modal-backdrop--enter');
      this.element.classList.add('bbt-modal--enter');
    });
  }
}
