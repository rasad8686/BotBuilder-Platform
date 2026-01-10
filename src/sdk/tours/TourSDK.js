/**
 * BotBuilder Tours SDK
 * Product tours for customer websites
 */

import { TourEngine } from './TourEngine';
import { TourRenderer } from './TourRenderer';
import { EventEmitter } from './utils/events';
import { getVisitorId, setVisitorId, getProgress, setProgress, clearProgress } from './utils/storage';
import { initApi } from './utils/api';

class TourSDK extends EventEmitter {
  constructor() {
    super();
    this.config = null;
    this.engine = null;
    this.renderer = null;
    this.currentTour = null;
    this.currentStepIndex = 0;
    this.initialized = false;
    this.visitorId = null;
    this.userId = null;
    this.userTraits = {};
  }

  /**
   * Initialize the SDK
   * @param {Object} config - Configuration object
   * @param {string} config.workspaceId - Workspace ID (required)
   * @param {string} [config.userId] - User ID (optional)
   * @param {string} [config.visitorId] - Visitor ID (optional, auto-generated if not provided)
   * @param {string} [config.apiUrl] - API URL (optional, defaults to production)
   * @param {boolean} [config.autoStart=true] - Auto start tours based on targeting
   * @param {string} [config.theme='light'] - Theme: 'light' or 'dark'
   */
  init(config) {
    if (this.initialized) {
      console.warn('[BotBuilderTours] SDK already initialized');
      return this;
    }

    if (!config.workspaceId) {
      throw new Error('[BotBuilderTours] workspaceId is required');
    }

    this.config = {
      workspaceId: config.workspaceId,
      userId: config.userId || null,
      visitorId: config.visitorId || getVisitorId(),
      apiUrl: config.apiUrl || 'https://api.botbuilder.app',
      autoStart: config.autoStart !== false,
      theme: config.theme || 'light',
    };

    // Save visitor ID
    this.visitorId = this.config.visitorId;
    setVisitorId(this.visitorId);

    if (this.config.userId) {
      this.userId = this.config.userId;
    }

    // Initialize API
    initApi(this.config.apiUrl, this.config.workspaceId);

    // Initialize engine and renderer
    this.engine = new TourEngine(this);
    this.renderer = new TourRenderer(this);

    // Apply theme
    this._applyTheme(this.config.theme);

    this.initialized = true;
    this.emit('sdk:initialized', { config: this.config });

    // Auto-load and start tours if enabled
    if (this.config.autoStart) {
      this._autoStartTours();
    }

    return this;
  }

  /**
   * Identify a user
   * @param {string} userId - User ID
   * @param {Object} [traits] - User traits for targeting
   */
  identify(userId, traits = {}) {
    if (!this.initialized) {
      throw new Error('[BotBuilderTours] SDK not initialized. Call init() first.');
    }

    this.userId = userId;
    this.userTraits = { ...this.userTraits, ...traits };

    this.emit('user:identified', { userId, traits: this.userTraits });

    // Re-check targeting after identification
    if (this.config.autoStart) {
      this._autoStartTours();
    }

    return this;
  }

  /**
   * Manually start a tour
   * @param {string} tourId - Tour ID
   */
  async startTour(tourId) {
    if (!this.initialized) {
      throw new Error('[BotBuilderTours] SDK not initialized. Call init() first.');
    }

    if (this.currentTour) {
      console.warn('[BotBuilderTours] A tour is already running. End it first.');
      return;
    }

    try {
      const tour = await this.engine.loadTour(tourId);
      if (!tour) {
        console.error(`[BotBuilderTours] Tour ${tourId} not found`);
        return;
      }

      this.currentTour = tour;
      this.currentStepIndex = 0;

      // Check for saved progress
      const progress = getProgress(tourId);
      if (progress && progress.currentStep > 0) {
        this.currentStepIndex = progress.currentStep;
      }

      this.emit('tour:started', { tour: this.currentTour, stepIndex: this.currentStepIndex });
      this.engine.trackEvent('tour_started', { tourId });

      this._showCurrentStep();
    } catch (error) {
      console.error('[BotBuilderTours] Failed to start tour:', error);
      this.emit('tour:error', { tourId, error });
    }
  }

  /**
   * End the current tour
   * @param {boolean} [completed=true] - Whether tour was completed or dismissed
   */
  endTour(completed = true) {
    if (!this.currentTour) {
      return;
    }

    const tour = this.currentTour;
    const eventType = completed ? 'tour:completed' : 'tour:dismissed';

    this.renderer.destroy();

    this.engine.trackEvent(completed ? 'tour_completed' : 'tour_dismissed', {
      tourId: tour.id,
      completedSteps: this.currentStepIndex + 1,
      totalSteps: tour.steps.length,
    });

    if (completed) {
      this.engine.saveProgress(tour.id, tour.steps.length - 1, 'completed');
    }

    this.emit(eventType, { tour, completedSteps: this.currentStepIndex + 1 });

    this.currentTour = null;
    this.currentStepIndex = 0;
  }

  /**
   * Go to next step
   */
  nextStep() {
    if (!this.currentTour) {
      return;
    }

    const tour = this.currentTour;

    if (this.currentStepIndex >= tour.steps.length - 1) {
      // Last step, complete the tour
      this.endTour(true);
      return;
    }

    this.emit('step:completed', {
      tour,
      step: tour.steps[this.currentStepIndex],
      stepIndex: this.currentStepIndex,
    });

    this.currentStepIndex++;
    this.engine.saveProgress(tour.id, this.currentStepIndex, 'in_progress');

    this._showCurrentStep();
  }

  /**
   * Go to previous step
   */
  prevStep() {
    if (!this.currentTour || this.currentStepIndex === 0) {
      return;
    }

    this.currentStepIndex--;
    this._showCurrentStep();
  }

  /**
   * Skip the current tour
   */
  skipTour() {
    if (!this.currentTour) {
      return;
    }

    this.engine.saveProgress(this.currentTour.id, this.currentStepIndex, 'skipped');
    this.endTour(false);
  }

  /**
   * Go to a specific step
   * @param {number} stepIndex - Step index (0-based)
   */
  goToStep(stepIndex) {
    if (!this.currentTour) {
      return;
    }

    if (stepIndex < 0 || stepIndex >= this.currentTour.steps.length) {
      console.warn('[BotBuilderTours] Invalid step index');
      return;
    }

    this.currentStepIndex = stepIndex;
    this._showCurrentStep();
  }

  /**
   * Get current tour state
   */
  getState() {
    return {
      initialized: this.initialized,
      currentTour: this.currentTour,
      currentStepIndex: this.currentStepIndex,
      totalSteps: this.currentTour?.steps.length || 0,
      userId: this.userId,
      visitorId: this.visitorId,
    };
  }

  /**
   * Reset progress for a tour
   * @param {string} tourId - Tour ID
   */
  resetProgress(tourId) {
    clearProgress(tourId);
    this.emit('progress:reset', { tourId });
  }

  /**
   * Destroy the SDK instance
   */
  destroy() {
    if (this.currentTour) {
      this.endTour(false);
    }

    if (this.renderer) {
      this.renderer.destroy();
    }

    this.removeAllListeners();
    this.initialized = false;
    this.config = null;
    this.engine = null;
    this.renderer = null;

    this.emit('sdk:destroyed');
  }

  // Private methods

  _showCurrentStep() {
    const step = this.currentTour.steps[this.currentStepIndex];

    this.renderer.renderStep(step, {
      tour: this.currentTour,
      stepIndex: this.currentStepIndex,
      totalSteps: this.currentTour.steps.length,
      onNext: () => this.nextStep(),
      onPrev: () => this.prevStep(),
      onSkip: () => this.skipTour(),
      onClose: () => this.endTour(false),
    });

    this.emit('step:viewed', {
      tour: this.currentTour,
      step,
      stepIndex: this.currentStepIndex,
    });

    this.engine.trackEvent('step_viewed', {
      tourId: this.currentTour.id,
      stepId: step.id,
      stepIndex: this.currentStepIndex,
    });
  }

  async _autoStartTours() {
    try {
      const tours = await this.engine.loadActiveTours();

      for (const tour of tours) {
        const context = {
          url: window.location.href,
          pathname: window.location.pathname,
          userId: this.userId,
          visitorId: this.visitorId,
          userTraits: this.userTraits,
        };

        if (this.engine.shouldShowTour(tour, context)) {
          await this.startTour(tour.id);
          break; // Only start one tour at a time
        }
      }
    } catch (error) {
      console.error('[BotBuilderTours] Failed to auto-start tours:', error);
    }
  }

  _applyTheme(theme) {
    document.documentElement.setAttribute('data-botbuilder-theme', theme);
  }
}

// Create singleton instance
const instance = new TourSDK();

// Export as global for UMD
if (typeof window !== 'undefined') {
  window.BotBuilderTours = instance;
}

export default instance;
export { TourSDK };
