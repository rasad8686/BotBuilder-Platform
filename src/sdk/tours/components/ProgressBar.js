/**
 * ProgressBar Component
 * Shows tour progress at the bottom of the screen
 */

export class ProgressBar {
  constructor(options) {
    this.options = {
      current: 0,
      total: 1,
      theme: 'light',
      position: 'bottom', // top, bottom
      showStepNumbers: true,
      primaryColor: null,
      ...options,
    };

    this.element = null;
  }

  render(container) {
    this._createProgressBar();
    container.appendChild(this.element);
    this._animateIn();
  }

  destroy() {
    if (this.element) {
      this.element.classList.remove('bbt-progress-bar--enter');
      this.element.classList.add('bbt-progress-bar--exit');

      setTimeout(() => {
        if (this.element && this.element.parentNode) {
          this.element.parentNode.removeChild(this.element);
        }
      }, 200);
    }

    this.element = null;
  }

  update(current) {
    this.options.current = current;
    this._updateProgress();
  }

  _createProgressBar() {
    const { current, total, theme, position, showStepNumbers, primaryColor } = this.options;

    this.element = document.createElement('div');
    this.element.className = `bbt-progress-bar bbt-progress-bar--${position} bbt-progress-bar--${theme}`;

    if (primaryColor) {
      this.element.style.setProperty('--bbt-primary-color', primaryColor);
    }

    // Progress track
    const track = document.createElement('div');
    track.className = 'bbt-progress-bar__track';

    // Step dots
    for (let i = 0; i < total; i++) {
      const step = document.createElement('div');
      step.className = 'bbt-progress-bar__step';

      if (i < current) {
        step.classList.add('bbt-progress-bar__step--completed');
      } else if (i === current) {
        step.classList.add('bbt-progress-bar__step--active');
      }

      // Connector line (except for last step)
      if (i < total - 1) {
        const connector = document.createElement('div');
        connector.className = 'bbt-progress-bar__connector';

        if (i < current) {
          connector.classList.add('bbt-progress-bar__connector--completed');
        }

        step.appendChild(connector);
      }

      // Step dot
      const dot = document.createElement('div');
      dot.className = 'bbt-progress-bar__dot';

      if (showStepNumbers) {
        dot.textContent = i + 1;
      }

      step.appendChild(dot);
      track.appendChild(step);
    }

    this.element.appendChild(track);

    // Text indicator
    const text = document.createElement('div');
    text.className = 'bbt-progress-bar__text';
    text.textContent = `Step ${current + 1} of ${total}`;
    this.element.appendChild(text);
  }

  _updateProgress() {
    const { current, total } = this.options;

    // Update steps
    const steps = this.element.querySelectorAll('.bbt-progress-bar__step');
    steps.forEach((step, i) => {
      step.classList.remove('bbt-progress-bar__step--completed', 'bbt-progress-bar__step--active');

      if (i < current) {
        step.classList.add('bbt-progress-bar__step--completed');
      } else if (i === current) {
        step.classList.add('bbt-progress-bar__step--active');
      }
    });

    // Update connectors
    const connectors = this.element.querySelectorAll('.bbt-progress-bar__connector');
    connectors.forEach((connector, i) => {
      connector.classList.toggle('bbt-progress-bar__connector--completed', i < current);
    });

    // Update text
    const text = this.element.querySelector('.bbt-progress-bar__text');
    if (text) {
      text.textContent = `Step ${current + 1} of ${total}`;
    }
  }

  _animateIn() {
    requestAnimationFrame(() => {
      this.element.classList.add('bbt-progress-bar--enter');
    });
  }
}

/**
 * Minimal progress indicator (dots only)
 */
export class ProgressDots {
  constructor(options) {
    this.options = {
      current: 0,
      total: 1,
      theme: 'light',
      primaryColor: null,
      ...options,
    };

    this.element = null;
  }

  render(container) {
    this._createDots();
    container.appendChild(this.element);
  }

  destroy() {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    this.element = null;
  }

  update(current) {
    this.options.current = current;
    this._updateDots();
  }

  _createDots() {
    const { current, total, theme, primaryColor } = this.options;

    this.element = document.createElement('div');
    this.element.className = `bbt-progress-dots bbt-progress-dots--${theme}`;

    if (primaryColor) {
      this.element.style.setProperty('--bbt-primary-color', primaryColor);
    }

    for (let i = 0; i < total; i++) {
      const dot = document.createElement('div');
      dot.className = 'bbt-progress-dots__dot';

      if (i < current) {
        dot.classList.add('bbt-progress-dots__dot--completed');
      } else if (i === current) {
        dot.classList.add('bbt-progress-dots__dot--active');
      }

      this.element.appendChild(dot);
    }
  }

  _updateDots() {
    const { current } = this.options;

    const dots = this.element.querySelectorAll('.bbt-progress-dots__dot');
    dots.forEach((dot, i) => {
      dot.classList.remove('bbt-progress-dots__dot--completed', 'bbt-progress-dots__dot--active');

      if (i < current) {
        dot.classList.add('bbt-progress-dots__dot--completed');
      } else if (i === current) {
        dot.classList.add('bbt-progress-dots__dot--active');
      }
    });
  }
}
