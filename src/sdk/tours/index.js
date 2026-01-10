/**
 * BotBuilder Tours SDK
 * Entry point for the SDK
 *
 * Usage:
 * <script src="https://yourdomain.com/tours-sdk.min.js"></script>
 * <script>
 *   BotBuilderTours.init({ apiKey: 'xxx' });
 *   BotBuilderTours.startTour('tour-id');
 * </script>
 *
 * SDK Methods:
 * - init(config)        Initialize the SDK
 * - startTour(tourId)   Start a specific tour
 * - stopTour()          Stop the current tour
 * - nextStep()          Go to next step
 * - prevStep()          Go to previous step
 * - goToStep(index)     Go to a specific step
 * - onComplete(cb)      Register completion callback
 * - onSkip(cb)          Register skip callback
 */

import TourSDKInstance, { TourSDK } from './TourSDK';
import { TourEngine } from './TourEngine';
import { TourRenderer } from './TourRenderer';
import { EventEmitter, EVENTS } from './utils/events';

// SDK instance (singleton)
const sdk = TourSDKInstance;

// ==========================================
// PUBLIC API METHODS
// ==========================================

/**
 * Initialize the SDK
 * @param {Object} config - Configuration object
 * @param {string} config.apiKey - API key (alias for workspaceId)
 * @param {string} [config.workspaceId] - Workspace ID
 * @param {string} [config.userId] - User ID for targeting
 * @param {boolean} [config.autoStart=true] - Auto start tours
 * @param {string} [config.theme='light'] - Theme: 'light' or 'dark'
 */
function init(config) {
  // Support apiKey as alias for workspaceId
  const normalizedConfig = {
    ...config,
    workspaceId: config.workspaceId || config.apiKey
  };
  return sdk.init(normalizedConfig);
}

/**
 * Start a specific tour
 * @param {string} tourId - Tour ID to start
 */
function startTour(tourId) {
  return sdk.startTour(tourId);
}

/**
 * Stop the current tour
 * Alias for endTour(false)
 */
function stopTour() {
  return sdk.endTour(false);
}

/**
 * Go to the next step
 */
function nextStep() {
  return sdk.nextStep();
}

/**
 * Go to the previous step
 */
function prevStep() {
  return sdk.prevStep();
}

/**
 * Go to a specific step
 * @param {number} index - Step index (0-based)
 */
function goToStep(index) {
  return sdk.goToStep(index);
}

/**
 * Register a callback for tour completion
 * @param {Function} callback - Callback function
 */
function onComplete(callback) {
  sdk.on('tour:completed', callback);
  return sdk;
}

/**
 * Register a callback for tour skip
 * @param {Function} callback - Callback function
 */
function onSkip(callback) {
  sdk.on('tour:dismissed', callback);
  return sdk;
}

/**
 * Register a callback for step viewed
 * @param {Function} callback - Callback function
 */
function onStepViewed(callback) {
  sdk.on('step:viewed', callback);
  return sdk;
}

/**
 * Register a callback for step completed
 * @param {Function} callback - Callback function
 */
function onStepComplete(callback) {
  sdk.on('step:completed', callback);
  return sdk;
}

/**
 * Register a callback for tour started
 * @param {Function} callback - Callback function
 */
function onStart(callback) {
  sdk.on('tour:started', callback);
  return sdk;
}

/**
 * Identify a user
 * @param {string} userId - User ID
 * @param {Object} [traits] - User traits for targeting
 */
function identify(userId, traits) {
  return sdk.identify(userId, traits);
}

/**
 * Get current tour state
 */
function getState() {
  return sdk.getState();
}

/**
 * Reset progress for a tour
 * @param {string} tourId - Tour ID
 */
function resetProgress(tourId) {
  return sdk.resetProgress(tourId);
}

/**
 * Destroy the SDK instance
 */
function destroy() {
  return sdk.destroy();
}

/**
 * End tour (alias with completion status)
 * @param {boolean} [completed=true] - Whether tour was completed
 */
function endTour(completed = true) {
  return sdk.endTour(completed);
}

/**
 * Skip current tour
 */
function skipTour() {
  return sdk.skipTour();
}

// ==========================================
// EXPORTS
// ==========================================

// Named exports for direct access
export {
  // Core API methods
  init,
  startTour,
  stopTour,
  nextStep,
  prevStep,
  goToStep,
  onComplete,
  onSkip,
  onStepViewed,
  onStepComplete,
  onStart,
  identify,
  getState,
  resetProgress,
  destroy,
  endTour,
  skipTour,

  // Classes for advanced usage
  TourSDK,
  TourEngine,
  TourRenderer,
  EventEmitter,
  EVENTS
};

// Export utilities for custom implementations
export * from './utils/dom';
export * from './utils/positioning';
export * from './utils/storage';
export * from './utils/api';
export * from './utils/events';

// Export components for custom rendering
export { Tooltip } from './components/Tooltip';
export { Modal } from './components/Modal';
export { Hotspot } from './components/Hotspot';
export { Slideout } from './components/Slideout';
export { Overlay, Highlight } from './components/Overlay';
export { ProgressBar, ProgressDots } from './components/ProgressBar';

// Default export - SDK instance with all methods
export default {
  // SDK instance
  sdk,

  // Public API methods
  init,
  startTour,
  stopTour,
  nextStep,
  prevStep,
  goToStep,
  onComplete,
  onSkip,
  onStepViewed,
  onStepComplete,
  onStart,
  identify,
  getState,
  resetProgress,
  destroy,
  endTour,
  skipTour,

  // Classes
  TourSDK,
  TourEngine,
  TourRenderer,
  EventEmitter,
  EVENTS
};
