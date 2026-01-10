/**
 * BotBuilder Tours SDK TypeScript Definitions
 */

declare module '@botbuilder/tours-sdk' {
  export interface TourConfig {
    /** Workspace ID (required) */
    workspaceId: string;
    /** User ID (optional) */
    userId?: string;
    /** Visitor ID (optional, auto-generated if not provided) */
    visitorId?: string;
    /** API URL (optional, defaults to production) */
    apiUrl?: string;
    /** Auto start tours based on targeting (default: true) */
    autoStart?: boolean;
    /** Theme: 'light' or 'dark' (default: 'light') */
    theme?: 'light' | 'dark';
  }

  export interface UserTraits {
    [key: string]: string | number | boolean | null;
  }

  export interface Tour {
    id: string;
    name: string;
    description?: string;
    status: 'draft' | 'active' | 'paused' | 'archived';
    steps: TourStep[];
    targeting?: TourTargeting;
    settings?: TourSettings;
    pageUrl?: string;
    pageUrlMatch?: 'exact' | 'contains' | 'regex';
    startDate?: string;
    endDate?: string;
  }

  export interface TourStep {
    id: string;
    type: 'tooltip' | 'modal' | 'hotspot' | 'slideout';
    title?: string;
    content?: string;
    targetSelector?: string;
    position?: 'top' | 'bottom' | 'left' | 'right' | 'auto';
    media?: StepMedia;
    buttons?: StepButton[];
    trigger?: StepTrigger;
    overlay?: boolean;
    overlayPadding?: number;
    overlayOpacity?: number;
    overlayClickClose?: boolean;
    scrollTo?: boolean;
    scrollBehavior?: 'smooth' | 'instant';
    scrollBlock?: 'start' | 'center' | 'end' | 'nearest';
    waitTimeout?: number;
    hotspotColor?: string;
    pulse?: boolean;
    slidePosition?: 'left' | 'right';
    slideWidth?: number;
    size?: 'small' | 'medium' | 'large';
  }

  export interface StepMedia {
    type: 'image' | 'video' | 'embed' | 'lottie';
    src: string;
    alt?: string;
    autoplay?: boolean;
    muted?: boolean;
    loop?: boolean;
  }

  export interface StepButton {
    text: string;
    action?: 'next' | 'prev' | 'skip' | 'close';
    variant?: 'primary' | 'secondary' | 'text';
    onClick?: () => void;
  }

  export interface StepTrigger {
    type: 'click' | 'input' | 'custom';
    event?: string;
  }

  export interface TourTargeting {
    operator?: 'AND' | 'OR';
    rules: TargetingRule[];
  }

  export interface TargetingRule {
    type: 'url' | 'user' | 'device' | 'custom';
    field: string;
    operator: TargetingOperator;
    value: string | string[];
  }

  export type TargetingOperator =
    | 'equals'
    | 'not_equals'
    | 'contains'
    | 'not_contains'
    | 'starts_with'
    | 'ends_with'
    | 'matches_regex'
    | 'greater_than'
    | 'less_than'
    | 'exists'
    | 'not_exists'
    | 'is_empty'
    | 'is_not_empty'
    | 'in_list'
    | 'not_in_list';

  export interface TourSettings {
    showProgress?: boolean;
    showBackButton?: boolean;
    showSkipButton?: boolean;
    allowReplay?: boolean;
    skipCooldown?: number;
    primaryColor?: string;
  }

  export interface TourProgress {
    tourId: string;
    currentStep: number;
    status: 'in_progress' | 'completed' | 'skipped';
    visitorId: string;
    userId?: string;
    updatedAt: string;
  }

  export interface SDKState {
    initialized: boolean;
    currentTour: Tour | null;
    currentStepIndex: number;
    totalSteps: number;
    userId: string | null;
    visitorId: string | null;
  }

  export type SDKEvent =
    | 'sdk:initialized'
    | 'sdk:destroyed'
    | 'user:identified'
    | 'tour:started'
    | 'tour:completed'
    | 'tour:dismissed'
    | 'tour:error'
    | 'step:viewed'
    | 'step:completed'
    | 'step:skipped'
    | 'progress:saved'
    | 'progress:reset';

  export interface TourEventData {
    tour: Tour;
    completedSteps?: number;
  }

  export interface StepEventData {
    tour: Tour;
    step: TourStep;
    stepIndex: number;
  }

  export interface ErrorEventData {
    tourId: string;
    error: Error;
  }

  export type EventCallback<T = any> = (data: T) => void;

  export class TourSDK {
    /**
     * Initialize the SDK
     */
    init(config: TourConfig): TourSDK;

    /**
     * Identify a user
     */
    identify(userId: string, traits?: UserTraits): TourSDK;

    /**
     * Start a tour manually
     */
    startTour(tourId: string): Promise<void>;

    /**
     * End the current tour
     */
    endTour(completed?: boolean): void;

    /**
     * Go to the next step
     */
    nextStep(): void;

    /**
     * Go to the previous step
     */
    prevStep(): void;

    /**
     * Skip the current tour
     */
    skipTour(): void;

    /**
     * Go to a specific step
     */
    goToStep(stepIndex: number): void;

    /**
     * Get the current SDK state
     */
    getState(): SDKState;

    /**
     * Reset progress for a tour
     */
    resetProgress(tourId: string): void;

    /**
     * Add an event listener
     */
    on<T = any>(event: SDKEvent | string, callback: EventCallback<T>): TourSDK;

    /**
     * Add a one-time event listener
     */
    once<T = any>(event: SDKEvent | string, callback: EventCallback<T>): TourSDK;

    /**
     * Remove an event listener
     */
    off<T = any>(event: SDKEvent | string, callback: EventCallback<T>): TourSDK;

    /**
     * Destroy the SDK instance
     */
    destroy(): void;
  }

  const sdk: TourSDK;
  export default sdk;
}

declare global {
  interface Window {
    BotBuilderTours: import('@botbuilder/tours-sdk').TourSDK;
  }
}
