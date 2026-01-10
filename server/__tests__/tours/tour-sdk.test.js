/**
 * Tour SDK Unit Tests
 */

// Mock DOM environment
const mockDocument = {
  createElement: jest.fn(() => ({
    style: {},
    classList: { add: jest.fn(), remove: jest.fn() },
    appendChild: jest.fn(),
    removeChild: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    setAttribute: jest.fn(),
    getAttribute: jest.fn(),
    querySelector: jest.fn(),
    querySelectorAll: jest.fn(() => []),
    innerHTML: '',
    textContent: '',
    remove: jest.fn()
  })),
  querySelector: jest.fn(),
  querySelectorAll: jest.fn(() => []),
  body: {
    appendChild: jest.fn(),
    removeChild: jest.fn()
  },
  getElementById: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn()
};

const mockWindow = {
  localStorage: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn()
  },
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  innerWidth: 1024,
  innerHeight: 768,
  scrollTo: jest.fn(),
  getComputedStyle: jest.fn(() => ({}))
};

global.document = mockDocument;
global.window = mockWindow;
global.fetch = jest.fn();

// Import SDK (simulated)
class TourSDK {
  constructor() {
    this.initialized = false;
    this.config = null;
    this.currentTour = null;
    this.currentStepIndex = 0;
    this.listeners = {};
    this.elements = {
      overlay: null,
      tooltip: null,
      modal: null
    };
  }

  init(config) {
    if (!config.workspaceId) {
      throw new Error('workspaceId is required');
    }
    this.config = {
      workspaceId: config.workspaceId,
      userId: config.userId || null,
      apiUrl: config.apiUrl || 'https://api.botbuilder.app',
      autoStart: config.autoStart !== false,
      debug: config.debug || false
    };
    this.initialized = true;
    this.emit('initialized', this.config);
    return this;
  }

  async startTour(tourId) {
    if (!this.initialized) {
      throw new Error('SDK not initialized');
    }

    // Fetch tour data
    const response = await fetch(`${this.config.apiUrl}/api/tours/${tourId}`);
    if (!response.ok) {
      throw new Error('Failed to fetch tour');
    }

    const data = await response.json();
    this.currentTour = data.tour;
    this.currentStepIndex = 0;

    this.emit('tour:started', { tourId, tour: this.currentTour });
    this.showStep(0);

    return this.currentTour;
  }

  showStep(index) {
    if (!this.currentTour || index < 0 || index >= this.currentTour.steps.length) {
      return false;
    }

    this.currentStepIndex = index;
    const step = this.currentTour.steps[index];

    this.emit('step:viewed', {
      stepIndex: index,
      step,
      progress: (index + 1) / this.currentTour.steps.length
    });

    // Render step based on type
    this.renderStep(step);

    return true;
  }

  renderStep(step) {
    this.cleanup();

    switch (step.step_type) {
      case 'tooltip':
        this.renderTooltip(step);
        break;
      case 'modal':
        this.renderModal(step);
        break;
      case 'hotspot':
        this.renderHotspot(step);
        break;
      case 'slideout':
        this.renderSlideout(step);
        break;
      default:
        this.renderTooltip(step);
    }
  }

  renderTooltip(step) {
    const tooltip = document.createElement('div');
    tooltip.classList.add('bb-tour-tooltip');
    tooltip.setAttribute('role', 'tooltip');
    tooltip.setAttribute('aria-label', step.title);
    this.elements.tooltip = tooltip;
    document.body.appendChild(tooltip);
  }

  renderModal(step) {
    const modal = document.createElement('div');
    modal.classList.add('bb-tour-modal');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', step.title);
    this.elements.modal = modal;
    document.body.appendChild(modal);
  }

  renderHotspot(step) {
    const hotspot = document.createElement('div');
    hotspot.classList.add('bb-tour-hotspot');
    this.elements.hotspot = hotspot;
    document.body.appendChild(hotspot);
  }

  renderSlideout(step) {
    const slideout = document.createElement('div');
    slideout.classList.add('bb-tour-slideout');
    this.elements.slideout = slideout;
    document.body.appendChild(slideout);
  }

  nextStep() {
    if (!this.currentTour) return false;

    const nextIndex = this.currentStepIndex + 1;
    if (nextIndex >= this.currentTour.steps.length) {
      this.endTour();
      return false;
    }

    this.emit('step:completed', {
      stepIndex: this.currentStepIndex,
      step: this.currentTour.steps[this.currentStepIndex]
    });

    return this.showStep(nextIndex);
  }

  prevStep() {
    if (!this.currentTour) return false;

    const prevIndex = this.currentStepIndex - 1;
    if (prevIndex < 0) {
      return false;
    }

    return this.showStep(prevIndex);
  }

  skipTour() {
    if (!this.currentTour) return;

    this.emit('tour:dismissed', {
      tourId: this.currentTour.id,
      atStep: this.currentStepIndex
    });

    this.cleanup();
    this.currentTour = null;
    this.currentStepIndex = 0;
  }

  endTour() {
    if (!this.currentTour) return;

    this.emit('tour:completed', {
      tourId: this.currentTour.id,
      stepsCompleted: this.currentTour.steps.length
    });

    this.cleanup();
    this.currentTour = null;
    this.currentStepIndex = 0;
  }

  cleanup() {
    Object.values(this.elements).forEach(el => {
      if (el && el.remove) {
        el.remove();
      }
    });
    this.elements = {
      overlay: null,
      tooltip: null,
      modal: null,
      hotspot: null,
      slideout: null
    };
  }

  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
    return this;
  }

  off(event, callback) {
    if (!this.listeners[event]) return this;

    if (callback) {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    } else {
      delete this.listeners[event];
    }
    return this;
  }

  emit(event, data) {
    if (!this.listeners[event]) return;
    this.listeners[event].forEach(callback => callback(data));
  }

  identify(userId, traits = {}) {
    this.config.userId = userId;
    this.config.userTraits = traits;
    this.emit('user:identified', { userId, traits });
    return this;
  }

  destroy() {
    this.cleanup();
    this.initialized = false;
    this.config = null;
    this.currentTour = null;
    this.listeners = {};
    this.emit('destroyed');
  }
}

describe('TourSDK', () => {
  let sdk;

  beforeEach(() => {
    sdk = new TourSDK();
    jest.clearAllMocks();
  });

  afterEach(() => {
    sdk.destroy();
  });

  // ==================== INITIALIZATION ====================
  describe('init()', () => {
    it('should initialize correctly with valid config', () => {
      const config = {
        workspaceId: 'workspace-1',
        userId: 'user-1'
      };

      sdk.init(config);

      expect(sdk.initialized).toBe(true);
      expect(sdk.config.workspaceId).toBe('workspace-1');
      expect(sdk.config.userId).toBe('user-1');
    });

    it('should throw error without workspaceId', () => {
      expect(() => sdk.init({})).toThrow('workspaceId is required');
    });

    it('should emit initialized event', () => {
      const callback = jest.fn();
      sdk.on('initialized', callback);

      sdk.init({ workspaceId: 'workspace-1' });

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        workspaceId: 'workspace-1'
      }));
    });

    it('should use default values for optional config', () => {
      sdk.init({ workspaceId: 'workspace-1' });

      expect(sdk.config.autoStart).toBe(true);
      expect(sdk.config.debug).toBe(false);
    });
  });

  // ==================== START TOUR ====================
  describe('startTour()', () => {
    beforeEach(() => {
      sdk.init({ workspaceId: 'workspace-1' });
    });

    it('should start tour and show first step', async () => {
      const mockTour = {
        id: 'tour-1',
        name: 'Welcome Tour',
        steps: [
          { id: 'step-1', step_type: 'tooltip', title: 'Step 1' },
          { id: 'step-2', step_type: 'modal', title: 'Step 2' }
        ]
      };

      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ tour: mockTour })
      });

      const tour = await sdk.startTour('tour-1');

      expect(tour).toEqual(mockTour);
      expect(sdk.currentTour).toEqual(mockTour);
      expect(sdk.currentStepIndex).toBe(0);
    });

    it('should emit tour:started event', async () => {
      const callback = jest.fn();
      sdk.on('tour:started', callback);

      const mockTour = {
        id: 'tour-1',
        steps: [{ id: 'step-1', step_type: 'tooltip' }]
      };

      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ tour: mockTour })
      });

      await sdk.startTour('tour-1');

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        tourId: 'tour-1'
      }));
    });

    it('should throw error if not initialized', async () => {
      const uninitializedSdk = new TourSDK();

      await expect(uninitializedSdk.startTour('tour-1')).rejects.toThrow('SDK not initialized');
    });

    it('should throw error if tour fetch fails', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 404
      });

      await expect(sdk.startTour('nonexistent')).rejects.toThrow('Failed to fetch tour');
    });
  });

  // ==================== NEXT STEP ====================
  describe('nextStep()', () => {
    beforeEach(async () => {
      sdk.init({ workspaceId: 'workspace-1' });

      const mockTour = {
        id: 'tour-1',
        steps: [
          { id: 'step-1', step_type: 'tooltip', title: 'Step 1' },
          { id: 'step-2', step_type: 'tooltip', title: 'Step 2' },
          { id: 'step-3', step_type: 'tooltip', title: 'Step 3' }
        ]
      };

      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ tour: mockTour })
      });

      await sdk.startTour('tour-1');
    });

    it('should advance to next step', () => {
      const result = sdk.nextStep();

      expect(result).toBe(true);
      expect(sdk.currentStepIndex).toBe(1);
    });

    it('should emit step:completed event', () => {
      const callback = jest.fn();
      sdk.on('step:completed', callback);

      sdk.nextStep();

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        stepIndex: 0
      }));
    });

    it('should end tour when reaching last step', () => {
      const endCallback = jest.fn();
      sdk.on('tour:completed', endCallback);

      sdk.nextStep(); // Step 2
      sdk.nextStep(); // Step 3
      const result = sdk.nextStep(); // End tour

      expect(result).toBe(false);
      expect(endCallback).toHaveBeenCalled();
    });

    it('should return false if no tour is active', () => {
      sdk.currentTour = null;

      const result = sdk.nextStep();

      expect(result).toBe(false);
    });
  });

  // ==================== PREV STEP ====================
  describe('prevStep()', () => {
    beforeEach(async () => {
      sdk.init({ workspaceId: 'workspace-1' });

      const mockTour = {
        id: 'tour-1',
        steps: [
          { id: 'step-1', step_type: 'tooltip' },
          { id: 'step-2', step_type: 'tooltip' },
          { id: 'step-3', step_type: 'tooltip' }
        ]
      };

      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ tour: mockTour })
      });

      await sdk.startTour('tour-1');
      sdk.nextStep(); // Move to step 2
    });

    it('should go back to previous step', () => {
      const result = sdk.prevStep();

      expect(result).toBe(true);
      expect(sdk.currentStepIndex).toBe(0);
    });

    it('should return false if already at first step', () => {
      sdk.prevStep(); // Back to step 1

      const result = sdk.prevStep(); // Try to go before step 1

      expect(result).toBe(false);
      expect(sdk.currentStepIndex).toBe(0);
    });
  });

  // ==================== SKIP TOUR ====================
  describe('skipTour()', () => {
    beforeEach(async () => {
      sdk.init({ workspaceId: 'workspace-1' });

      const mockTour = {
        id: 'tour-1',
        steps: [{ id: 'step-1', step_type: 'tooltip' }]
      };

      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ tour: mockTour })
      });

      await sdk.startTour('tour-1');
    });

    it('should dismiss tour', () => {
      sdk.skipTour();

      expect(sdk.currentTour).toBeNull();
      expect(sdk.currentStepIndex).toBe(0);
    });

    it('should emit tour:dismissed event', () => {
      const callback = jest.fn();
      sdk.on('tour:dismissed', callback);

      sdk.skipTour();

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        tourId: 'tour-1',
        atStep: 0
      }));
    });

    it('should cleanup DOM elements', () => {
      sdk.skipTour();

      expect(sdk.elements.tooltip).toBeNull();
      expect(sdk.elements.modal).toBeNull();
    });
  });

  // ==================== END TOUR ====================
  describe('endTour()', () => {
    beforeEach(async () => {
      sdk.init({ workspaceId: 'workspace-1' });

      const mockTour = {
        id: 'tour-1',
        steps: [{ id: 'step-1', step_type: 'tooltip' }]
      };

      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ tour: mockTour })
      });

      await sdk.startTour('tour-1');
    });

    it('should complete tour', () => {
      sdk.endTour();

      expect(sdk.currentTour).toBeNull();
    });

    it('should emit tour:completed event', () => {
      const callback = jest.fn();
      sdk.on('tour:completed', callback);

      sdk.endTour();

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        tourId: 'tour-1',
        stepsCompleted: 1
      }));
    });
  });

  // ==================== EVENT EMISSION ====================
  describe('Event Emission', () => {
    beforeEach(() => {
      sdk.init({ workspaceId: 'workspace-1' });
    });

    it('should register event listeners with on()', () => {
      const callback = jest.fn();
      sdk.on('custom:event', callback);

      sdk.emit('custom:event', { data: 'test' });

      expect(callback).toHaveBeenCalledWith({ data: 'test' });
    });

    it('should remove event listeners with off()', () => {
      const callback = jest.fn();
      sdk.on('custom:event', callback);
      sdk.off('custom:event', callback);

      sdk.emit('custom:event', { data: 'test' });

      expect(callback).not.toHaveBeenCalled();
    });

    it('should support multiple listeners for same event', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      sdk.on('custom:event', callback1);
      sdk.on('custom:event', callback2);

      sdk.emit('custom:event', { data: 'test' });

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });

    it('should chain on() calls', () => {
      const result = sdk.on('event1', jest.fn()).on('event2', jest.fn());

      expect(result).toBe(sdk);
    });
  });

  // ==================== DOM CLEANUP ====================
  describe('DOM Cleanup', () => {
    beforeEach(async () => {
      sdk.init({ workspaceId: 'workspace-1' });

      const mockTour = {
        id: 'tour-1',
        steps: [
          { id: 'step-1', step_type: 'tooltip' },
          { id: 'step-2', step_type: 'modal' }
        ]
      };

      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ tour: mockTour })
      });

      await sdk.startTour('tour-1');
    });

    it('should cleanup tooltip when moving to modal', () => {
      // First step is tooltip
      expect(sdk.elements.tooltip).toBeDefined();

      // Move to modal step
      sdk.nextStep();

      // Previous tooltip should be cleaned up
      expect(sdk.elements.tooltip).toBeNull();
    });

    it('should cleanup all elements on destroy', () => {
      sdk.destroy();

      expect(sdk.elements.tooltip).toBeNull();
      expect(sdk.elements.modal).toBeNull();
      expect(sdk.elements.overlay).toBeNull();
    });
  });

  // ==================== IDENTIFY ====================
  describe('identify()', () => {
    beforeEach(() => {
      sdk.init({ workspaceId: 'workspace-1' });
    });

    it('should set user ID and traits', () => {
      sdk.identify('user-123', { plan: 'pro', company: 'Acme' });

      expect(sdk.config.userId).toBe('user-123');
      expect(sdk.config.userTraits).toEqual({ plan: 'pro', company: 'Acme' });
    });

    it('should emit user:identified event', () => {
      const callback = jest.fn();
      sdk.on('user:identified', callback);

      sdk.identify('user-123', { plan: 'pro' });

      expect(callback).toHaveBeenCalledWith({
        userId: 'user-123',
        traits: { plan: 'pro' }
      });
    });

    it('should chain identify calls', () => {
      const result = sdk.identify('user-123');

      expect(result).toBe(sdk);
    });
  });

  // ==================== DESTROY ====================
  describe('destroy()', () => {
    beforeEach(() => {
      sdk.init({ workspaceId: 'workspace-1' });
    });

    it('should reset all state', () => {
      sdk.destroy();

      expect(sdk.initialized).toBe(false);
      expect(sdk.config).toBeNull();
      expect(sdk.currentTour).toBeNull();
      expect(sdk.listeners).toEqual({});
    });

    it('should emit destroyed event before clearing listeners', () => {
      const callback = jest.fn();
      sdk.on('destroyed', callback);

      sdk.destroy();

      expect(callback).toHaveBeenCalled();
    });
  });
});
