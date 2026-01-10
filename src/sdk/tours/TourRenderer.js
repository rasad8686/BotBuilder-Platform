/**
 * TourRenderer - Handles rendering of tour steps and UI components
 */

import { Tooltip } from './components/Tooltip';
import { Modal } from './components/Modal';
import { Hotspot } from './components/Hotspot';
import { Slideout } from './components/Slideout';
import { Overlay } from './components/Overlay';
import { ProgressBar } from './components/ProgressBar';
import { findElement, waitForElement, scrollToElement, isElementVisible } from './utils/dom';

export class TourRenderer {
  constructor(sdk) {
    this.sdk = sdk;
    this.container = null;
    this.currentComponent = null;
    this.overlay = null;
    this.progressBar = null;
    this.hotspots = [];

    this._createContainer();
  }

  /**
   * Render a step
   * @param {Object} step - Step configuration
   * @param {Object} options - Render options
   */
  async renderStep(step, options) {
    // Cleanup previous step
    this._cleanup();

    const { tour, stepIndex, totalSteps, onNext, onPrev, onSkip, onClose } = options;

    // Wait for target element if needed
    let targetElement = null;
    if (step.targetSelector) {
      targetElement = await waitForElement(step.targetSelector, step.waitTimeout || 5000);

      if (!targetElement) {
        console.warn(`[TourRenderer] Target element not found: ${step.targetSelector}`);
        // Show modal instead if target not found
        step.type = 'modal';
      }
    }

    // Scroll to element if needed
    if (targetElement && step.scrollTo !== false) {
      await scrollToElement(targetElement, {
        behavior: step.scrollBehavior || 'smooth',
        block: step.scrollBlock || 'center',
      });
    }

    // Show overlay if configured
    if (step.overlay !== false && targetElement) {
      this.overlay = new Overlay({
        targetElement,
        onClick: step.overlayClickClose ? onClose : null,
        padding: step.overlayPadding || 8,
        opacity: step.overlayOpacity || 0.5,
        theme: this.sdk.config.theme,
      });
      this.overlay.render(this.container);
    }

    // Show progress bar if configured
    if (tour.settings?.showProgress !== false && totalSteps > 1) {
      this.progressBar = new ProgressBar({
        current: stepIndex,
        total: totalSteps,
        theme: this.sdk.config.theme,
      });
      this.progressBar.render(this.container);
    }

    // Render the appropriate component based on step type
    const componentOptions = {
      step,
      targetElement,
      stepIndex,
      totalSteps,
      onNext,
      onPrev,
      onSkip,
      onClose,
      showBackButton: stepIndex > 0 && tour.settings?.showBackButton !== false,
      showSkipButton: tour.settings?.showSkipButton !== false,
      theme: this.sdk.config.theme,
      primaryColor: tour.settings?.primaryColor,
    };

    switch (step.type) {
      case 'tooltip':
        this._renderTooltip(componentOptions);
        break;
      case 'modal':
        this._renderModal(componentOptions);
        break;
      case 'hotspot':
        this._renderHotspot(componentOptions);
        break;
      case 'slideout':
        this._renderSlideout(componentOptions);
        break;
      default:
        this._renderTooltip(componentOptions);
    }

    // Handle step actions/triggers
    this._setupStepTriggers(step, targetElement, onNext);
  }

  /**
   * Render tooltip component
   */
  _renderTooltip(options) {
    const { step, targetElement, ...rest } = options;

    this.currentComponent = new Tooltip({
      title: step.title,
      content: step.content,
      position: step.position || 'bottom',
      targetElement,
      media: step.media,
      buttons: step.buttons,
      ...rest,
    });

    this.currentComponent.render(this.container);
  }

  /**
   * Render modal component
   */
  _renderModal(options) {
    const { step, ...rest } = options;

    this.currentComponent = new Modal({
      title: step.title,
      content: step.content,
      size: step.size || 'medium',
      media: step.media,
      buttons: step.buttons,
      ...rest,
    });

    this.currentComponent.render(this.container);
  }

  /**
   * Render hotspot component
   */
  _renderHotspot(options) {
    const { step, targetElement, ...rest } = options;

    if (!targetElement) {
      console.warn('[TourRenderer] Hotspot requires a target element');
      this._renderModal(options);
      return;
    }

    this.currentComponent = new Hotspot({
      targetElement,
      title: step.title,
      content: step.content,
      position: step.position || 'right',
      color: step.hotspotColor,
      pulse: step.pulse !== false,
      ...rest,
    });

    this.currentComponent.render(this.container);
  }

  /**
   * Render slideout component
   */
  _renderSlideout(options) {
    const { step, ...rest } = options;

    this.currentComponent = new Slideout({
      title: step.title,
      content: step.content,
      position: step.slidePosition || 'right',
      width: step.slideWidth,
      media: step.media,
      buttons: step.buttons,
      ...rest,
    });

    this.currentComponent.render(this.container);
  }

  /**
   * Setup step-specific triggers
   */
  _setupStepTriggers(step, targetElement, onNext) {
    if (!step.trigger || !targetElement) return;

    const { type, event } = step.trigger;

    switch (type) {
      case 'click':
        const clickHandler = () => {
          targetElement.removeEventListener('click', clickHandler);
          onNext();
        };
        targetElement.addEventListener('click', clickHandler);
        this._triggerCleanup = () => targetElement.removeEventListener('click', clickHandler);
        break;

      case 'input':
        const inputHandler = () => {
          if (targetElement.value.length > 0) {
            targetElement.removeEventListener('input', inputHandler);
            onNext();
          }
        };
        targetElement.addEventListener('input', inputHandler);
        this._triggerCleanup = () => targetElement.removeEventListener('input', inputHandler);
        break;

      case 'custom':
        // Custom event listener
        if (event) {
          const customHandler = () => {
            document.removeEventListener(event, customHandler);
            onNext();
          };
          document.addEventListener(event, customHandler);
          this._triggerCleanup = () => document.removeEventListener(event, customHandler);
        }
        break;
    }
  }

  /**
   * Destroy all rendered components
   */
  destroy() {
    this._cleanup();

    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }

    this.container = null;
  }

  // Private methods

  _createContainer() {
    // Remove existing container if any
    const existing = document.getElementById('botbuilder-tours-container');
    if (existing) {
      existing.parentNode.removeChild(existing);
    }

    this.container = document.createElement('div');
    this.container.id = 'botbuilder-tours-container';
    this.container.className = 'botbuilder-tours';
    document.body.appendChild(this.container);
  }

  _cleanup() {
    if (this.currentComponent) {
      this.currentComponent.destroy();
      this.currentComponent = null;
    }

    if (this.overlay) {
      this.overlay.destroy();
      this.overlay = null;
    }

    if (this.progressBar) {
      this.progressBar.destroy();
      this.progressBar = null;
    }

    this.hotspots.forEach((hotspot) => hotspot.destroy());
    this.hotspots = [];

    if (this._triggerCleanup) {
      this._triggerCleanup();
      this._triggerCleanup = null;
    }
  }
}
