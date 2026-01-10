/**
 * Slideout Component
 * Displays a side panel that slides in from left or right
 */

export class Slideout {
  constructor(options) {
    this.options = {
      title: '',
      content: '',
      position: 'right', // left, right
      width: 400, // Width in pixels
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
      showOverlay: true,
      closeOnOverlay: true,
      ...options,
    };

    this.element = null;
    this.overlayElement = null;
    this._keyHandler = null;
  }

  render(container) {
    if (this.options.showOverlay) {
      this._createOverlay();
      container.appendChild(this.overlayElement);
    }

    this._createSlideout();
    container.appendChild(this.element);

    this._setupListeners();
    this._animateIn();
  }

  destroy() {
    this._removeListeners();

    if (this.element) {
      this.element.classList.remove('bbt-slideout--enter');
      this.element.classList.add('bbt-slideout--exit');
    }
    if (this.overlayElement) {
      this.overlayElement.classList.remove('bbt-slideout-overlay--enter');
      this.overlayElement.classList.add('bbt-slideout-overlay--exit');
    }

    setTimeout(() => {
      if (this.element && this.element.parentNode) {
        this.element.parentNode.removeChild(this.element);
      }
      if (this.overlayElement && this.overlayElement.parentNode) {
        this.overlayElement.parentNode.removeChild(this.overlayElement);
      }
    }, 300);

    this.element = null;
    this.overlayElement = null;
  }

  _createOverlay() {
    this.overlayElement = document.createElement('div');
    this.overlayElement.className = `bbt-slideout-overlay bbt-slideout-overlay--${this.options.theme}`;

    if (this.options.closeOnOverlay) {
      this.overlayElement.onclick = () => this.options.onClose();
    }
  }

  _createSlideout() {
    const {
      title,
      content,
      position,
      width,
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
    this.element.className = `bbt-slideout bbt-slideout--${position} bbt-slideout--${theme}`;
    this.element.style.width = `${width}px`;

    if (primaryColor) {
      this.element.style.setProperty('--bbt-primary-color', primaryColor);
    }

    // Header
    const header = document.createElement('div');
    header.className = 'bbt-slideout__header';

    if (title) {
      const titleEl = document.createElement('h3');
      titleEl.className = 'bbt-slideout__title';
      titleEl.textContent = title;
      header.appendChild(titleEl);
    }

    const closeBtn = document.createElement('button');
    closeBtn.className = 'bbt-slideout__close';
    closeBtn.innerHTML = '&times;';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.onclick = (e) => {
      e.preventDefault();
      this.options.onClose();
    };
    header.appendChild(closeBtn);

    this.element.appendChild(header);

    // Body
    const body = document.createElement('div');
    body.className = 'bbt-slideout__body';

    // Media
    if (media) {
      const mediaEl = this._createMedia(media);
      body.appendChild(mediaEl);
    }

    // Content
    if (content) {
      const contentEl = document.createElement('div');
      contentEl.className = 'bbt-slideout__content';
      contentEl.innerHTML = content;
      body.appendChild(contentEl);
    }

    this.element.appendChild(body);

    // Footer
    const footer = document.createElement('div');
    footer.className = 'bbt-slideout__footer';

    // Progress
    if (totalSteps > 1) {
      const progress = document.createElement('div');
      progress.className = 'bbt-slideout__progress';

      const progressBar = document.createElement('div');
      progressBar.className = 'bbt-slideout__progress-bar';

      const progressFill = document.createElement('div');
      progressFill.className = 'bbt-slideout__progress-fill';
      progressFill.style.width = `${((stepIndex + 1) / totalSteps) * 100}%`;

      progressBar.appendChild(progressFill);
      progress.appendChild(progressBar);

      const progressText = document.createElement('span');
      progressText.className = 'bbt-slideout__progress-text';
      progressText.textContent = `Step ${stepIndex + 1} of ${totalSteps}`;
      progress.appendChild(progressText);

      footer.appendChild(progress);
    }

    // Actions
    const actions = document.createElement('div');
    actions.className = 'bbt-slideout__actions';

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

      const buttonGroup = document.createElement('div');
      buttonGroup.className = 'bbt-slideout__button-group';

      if (showBackButton) {
        const backBtn = document.createElement('button');
        backBtn.className = 'bbt-btn bbt-btn--secondary';
        backBtn.textContent = 'Back';
        backBtn.onclick = (e) => {
          e.preventDefault();
          this.options.onPrev();
        };
        buttonGroup.appendChild(backBtn);
      }

      const nextBtn = document.createElement('button');
      nextBtn.className = 'bbt-btn bbt-btn--primary';
      nextBtn.textContent = stepIndex >= totalSteps - 1 ? 'Finish' : 'Continue';
      nextBtn.onclick = (e) => {
        e.preventDefault();
        this.options.onNext();
      };
      buttonGroup.appendChild(nextBtn);

      actions.appendChild(buttonGroup);
    }

    footer.appendChild(actions);
    this.element.appendChild(footer);
  }

  _createMedia(media) {
    const container = document.createElement('div');
    container.className = 'bbt-slideout__media';

    if (media.type === 'image') {
      const img = document.createElement('img');
      img.src = media.src;
      img.alt = media.alt || '';
      img.className = 'bbt-slideout__image';
      container.appendChild(img);
    } else if (media.type === 'video') {
      const video = document.createElement('video');
      video.src = media.src;
      video.controls = true;
      video.autoplay = media.autoplay || false;
      video.muted = media.muted !== false;
      video.loop = media.loop || false;
      video.className = 'bbt-slideout__video';
      container.appendChild(video);
    } else if (media.type === 'embed') {
      const iframe = document.createElement('iframe');
      iframe.src = media.src;
      iframe.className = 'bbt-slideout__embed';
      iframe.allowFullscreen = true;
      container.appendChild(iframe);
    }

    return container;
  }

  _setupListeners() {
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
    if (this._keyHandler) {
      document.removeEventListener('keydown', this._keyHandler);
    }
  }

  _animateIn() {
    requestAnimationFrame(() => {
      if (this.overlayElement) {
        this.overlayElement.classList.add('bbt-slideout-overlay--enter');
      }
      this.element.classList.add('bbt-slideout--enter');
    });
  }
}
