/**
 * BotBuilder Tours Analytics SDK
 * Real-time analytics for product tours with offline queue support
 */

(function(window) {
  'use strict';

  const SOCKET_RECONNECT_INTERVAL = 3000;
  const MAX_RECONNECT_ATTEMPTS = 10;
  const BATCH_INTERVAL = 5000;
  const MAX_QUEUE_SIZE = 100;
  const STORAGE_KEY = 'botbuilder_tour_events_queue';

  class TourAnalytics {
    constructor(config = {}) {
      this.apiUrl = config.apiUrl || window.location.origin;
      this.wsUrl = config.wsUrl || this.apiUrl;
      this.socket = null;
      this.connected = false;
      this.reconnectAttempts = 0;
      this.eventQueue = [];
      this.batchTimeout = null;
      this.visitorId = this.getOrCreateVisitorId();
      this.sessionId = this.generateSessionId();
      this.currentTourId = null;
      this.currentStepIndex = 0;
      this.tourStartTime = null;
      this.stepStartTime = null;

      // Load queued events from storage
      this.loadQueueFromStorage();

      // Auto-connect if apiKey provided
      if (config.autoConnect !== false) {
        this.connect();
      }

      // Flush queue periodically
      this.startBatchProcessor();

      // Save queue before page unload
      window.addEventListener('beforeunload', () => {
        this.saveQueueToStorage();
      });
    }

    /**
     * Get or create visitor ID
     */
    getOrCreateVisitorId() {
      let visitorId = localStorage.getItem('botbuilder_visitor_id');
      if (!visitorId) {
        visitorId = 'v_' + this.generateId();
        localStorage.setItem('botbuilder_visitor_id', visitorId);
      }
      return visitorId;
    }

    /**
     * Generate session ID
     */
    generateSessionId() {
      return 's_' + this.generateId();
    }

    /**
     * Generate unique ID
     */
    generateId() {
      return Date.now().toString(36) + Math.random().toString(36).substring(2, 15);
    }

    /**
     * Connect to WebSocket server
     */
    connect() {
      if (this.socket && this.connected) return;

      try {
        // Use Socket.IO if available, otherwise fallback to native WebSocket
        if (typeof io !== 'undefined') {
          this.connectSocketIO();
        } else {
          this.loadSocketIO(() => {
            this.connectSocketIO();
          });
        }
      } catch (error) {
        console.error('[TourAnalytics] Connection error:', error);
        this.scheduleReconnect();
      }
    }

    /**
     * Load Socket.IO library dynamically
     */
    loadSocketIO(callback) {
      const script = document.createElement('script');
      script.src = 'https://cdn.socket.io/4.7.2/socket.io.min.js';
      script.onload = callback;
      script.onerror = () => {
        console.error('[TourAnalytics] Failed to load Socket.IO');
      };
      document.head.appendChild(script);
    }

    /**
     * Connect using Socket.IO
     */
    connectSocketIO() {
      this.socket = io(this.wsUrl + '/tours', {
        path: '/ws',
        transports: ['polling', 'websocket'],
        auth: {
          visitorId: this.visitorId,
          sessionId: this.sessionId
        }
      });

      this.socket.on('connect', () => {
        this.connected = true;
        this.reconnectAttempts = 0;
        console.log('[TourAnalytics] Connected');

        // Flush queued events
        this.flushQueue();
      });

      this.socket.on('disconnect', () => {
        this.connected = false;
        console.log('[TourAnalytics] Disconnected');
        this.scheduleReconnect();
      });

      this.socket.on('connect_error', (error) => {
        console.error('[TourAnalytics] Connection error:', error.message);
        this.scheduleReconnect();
      });

      // Batch acknowledgment
      this.socket.on('tour:batch_ack', (data) => {
        console.log('[TourAnalytics] Batch processed:', data.count, 'events');
      });
    }

    /**
     * Schedule reconnection
     */
    scheduleReconnect() {
      if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        console.error('[TourAnalytics] Max reconnection attempts reached');
        return;
      }

      this.reconnectAttempts++;
      const delay = SOCKET_RECONNECT_INTERVAL * this.reconnectAttempts;

      setTimeout(() => {
        if (!this.connected) {
          console.log('[TourAnalytics] Attempting reconnection...');
          this.connect();
        }
      }, delay);
    }

    /**
     * Disconnect from server
     */
    disconnect() {
      if (this.socket) {
        this.socket.disconnect();
        this.socket = null;
      }
      this.connected = false;
    }

    /**
     * Track tour started
     */
    trackTourStarted(tourId, metadata = {}) {
      this.currentTourId = tourId;
      this.currentStepIndex = 0;
      this.tourStartTime = Date.now();
      this.stepStartTime = Date.now();

      this.sendEvent('tour:started', {
        tourId,
        userId: this.visitorId,
        sessionId: this.sessionId,
        metadata: {
          ...metadata,
          url: window.location.href,
          userAgent: navigator.userAgent,
          referrer: document.referrer,
          screenSize: `${window.innerWidth}x${window.innerHeight}`
        }
      });
    }

    /**
     * Track step viewed
     */
    trackStepViewed(tourId, stepId, stepIndex) {
      // Calculate time spent on previous step
      const timeSpent = this.stepStartTime ? Date.now() - this.stepStartTime : 0;

      this.currentStepIndex = stepIndex;
      this.stepStartTime = Date.now();

      this.sendEvent('tour:step_viewed', {
        tourId: tourId || this.currentTourId,
        stepId,
        stepIndex,
        userId: this.visitorId,
        sessionId: this.sessionId,
        previousStepTime: timeSpent
      });
    }

    /**
     * Track step completed
     */
    trackStepCompleted(tourId, stepId, stepIndex) {
      const timeSpent = this.stepStartTime ? Date.now() - this.stepStartTime : 0;

      this.sendEvent('tour:step_completed', {
        tourId: tourId || this.currentTourId,
        stepId,
        stepIndex,
        userId: this.visitorId,
        sessionId: this.sessionId,
        timeSpent
      });
    }

    /**
     * Track tour completed
     */
    trackTourCompleted(tourId, totalSteps) {
      const duration = this.tourStartTime ? Date.now() - this.tourStartTime : 0;

      this.sendEvent('tour:completed', {
        tourId: tourId || this.currentTourId,
        userId: this.visitorId,
        sessionId: this.sessionId,
        duration,
        completedSteps: this.currentStepIndex + 1,
        totalSteps: totalSteps || this.currentStepIndex + 1
      });

      this.resetTourState();
    }

    /**
     * Track tour skipped
     */
    trackTourSkipped(tourId, reason = '') {
      this.sendEvent('tour:skipped', {
        tourId: tourId || this.currentTourId,
        userId: this.visitorId,
        sessionId: this.sessionId,
        skippedAtStep: this.currentStepIndex,
        reason
      });

      this.resetTourState();
    }

    /**
     * Track tour error
     */
    trackTourError(tourId, error, stepId = null) {
      this.sendEvent('tour:error', {
        tourId: tourId || this.currentTourId,
        userId: this.visitorId,
        sessionId: this.sessionId,
        error: typeof error === 'string' ? error : error.message,
        stepId
      });
    }

    /**
     * Reset tour state
     */
    resetTourState() {
      this.currentTourId = null;
      this.currentStepIndex = 0;
      this.tourStartTime = null;
      this.stepStartTime = null;
    }

    /**
     * Send event to server
     */
    sendEvent(type, data) {
      const event = {
        type: type.replace('tour:', ''),
        data,
        timestamp: new Date().toISOString()
      };

      if (this.connected && this.socket) {
        try {
          this.socket.emit(type, data);
        } catch (error) {
          console.error('[TourAnalytics] Error sending event:', error);
          this.queueEvent(event);
        }
      } else {
        this.queueEvent(event);
      }
    }

    /**
     * Queue event for later sending
     */
    queueEvent(event) {
      if (this.eventQueue.length >= MAX_QUEUE_SIZE) {
        // Remove oldest events
        this.eventQueue = this.eventQueue.slice(-MAX_QUEUE_SIZE + 1);
      }

      this.eventQueue.push(event);
      this.saveQueueToStorage();
    }

    /**
     * Flush queued events
     */
    flushQueue() {
      if (this.eventQueue.length === 0 || !this.connected) return;

      const eventsToSend = [...this.eventQueue];
      this.eventQueue = [];

      if (this.socket) {
        this.socket.emit('tour:batch_events', eventsToSend);
      }

      this.clearQueueStorage();
    }

    /**
     * Start batch processor
     */
    startBatchProcessor() {
      this.batchTimeout = setInterval(() => {
        if (this.connected && this.eventQueue.length > 0) {
          this.flushQueue();
        }
      }, BATCH_INTERVAL);
    }

    /**
     * Stop batch processor
     */
    stopBatchProcessor() {
      if (this.batchTimeout) {
        clearInterval(this.batchTimeout);
        this.batchTimeout = null;
      }
    }

    /**
     * Save queue to localStorage
     */
    saveQueueToStorage() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.eventQueue));
      } catch (error) {
        console.error('[TourAnalytics] Error saving queue:', error);
      }
    }

    /**
     * Load queue from localStorage
     */
    loadQueueFromStorage() {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          this.eventQueue = JSON.parse(stored);
        }
      } catch (error) {
        console.error('[TourAnalytics] Error loading queue:', error);
        this.eventQueue = [];
      }
    }

    /**
     * Clear queue storage
     */
    clearQueueStorage() {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (error) {
        console.error('[TourAnalytics] Error clearing queue:', error);
      }
    }

    /**
     * Get connection status
     */
    isConnected() {
      return this.connected;
    }

    /**
     * Get queued events count
     */
    getQueuedEventsCount() {
      return this.eventQueue.length;
    }

    /**
     * Destroy instance
     */
    destroy() {
      this.stopBatchProcessor();
      this.saveQueueToStorage();
      this.disconnect();
    }
  }

  // Export to window
  window.BotBuilderTourAnalytics = TourAnalytics;

  // Auto-initialize if data attribute present
  document.addEventListener('DOMContentLoaded', () => {
    const script = document.querySelector('script[data-tour-analytics]');
    if (script) {
      const apiUrl = script.getAttribute('data-api-url');
      window.tourAnalytics = new TourAnalytics({ apiUrl });
    }
  });

})(window);
