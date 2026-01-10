# BotBuilder Tours SDK

Lightweight JavaScript SDK for displaying interactive product tours.

## Installation

### Script Tag (Recommended)

```html
<script src="https://cdn.botbuilder.app/tours-sdk.js"></script>
```

### NPM

```bash
npm install @botbuilder/tours-sdk
```

```javascript
import BotBuilderTours from '@botbuilder/tours-sdk';
```

## Quick Start

```html
<script src="https://cdn.botbuilder.app/tours-sdk.js"></script>
<script>
  // Initialize the SDK
  BotBuilderTours.init({
    workspaceId: 'your-workspace-id',
    userId: 'optional-user-id'
  });

  // Start a tour
  BotBuilderTours.startTour('tour-id-here');
</script>
```

## Initialization

```javascript
BotBuilderTours.init({
  // Required: Your workspace ID
  workspaceId: 'ws_abc123',

  // Optional: User ID for personalization
  userId: 'user_123',

  // Optional: Custom API URL (default: https://api.botbuilder.app)
  apiUrl: 'https://your-api.com',

  // Optional: Auto-start tours based on targeting (default: true)
  autoStart: true,

  // Optional: Enable debug logging (default: false)
  debug: false
});
```

## Methods

### startTour(tourId)

Start a specific tour by ID.

```javascript
// Start a tour
await BotBuilderTours.startTour('tour_onboarding');

// With promise handling
BotBuilderTours.startTour('tour_onboarding')
  .then(tour => {
    console.log('Tour started:', tour.name);
  })
  .catch(error => {
    console.error('Failed to start tour:', error);
  });
```

### nextStep()

Advance to the next step in the current tour.

```javascript
BotBuilderTours.nextStep();
```

### prevStep()

Go back to the previous step.

```javascript
BotBuilderTours.prevStep();
```

### skipTour()

Skip/dismiss the current tour.

```javascript
BotBuilderTours.skipTour();
```

### endTour()

Complete the current tour (marks as completed in analytics).

```javascript
BotBuilderTours.endTour();
```

### identify(userId, traits)

Identify the current user for personalization and analytics.

```javascript
BotBuilderTours.identify('user_123', {
  plan: 'pro',
  company: 'Acme Inc',
  signupDate: '2024-01-15'
});
```

### on(event, callback)

Listen to SDK events.

```javascript
BotBuilderTours.on('tour:started', (data) => {
  console.log('Tour started:', data.tourId);
});
```

### off(event, callback)

Remove event listener.

```javascript
const handler = (data) => console.log(data);
BotBuilderTours.on('tour:started', handler);

// Remove specific handler
BotBuilderTours.off('tour:started', handler);

// Remove all handlers for event
BotBuilderTours.off('tour:started');
```

### destroy()

Cleanup SDK and remove all event listeners.

```javascript
BotBuilderTours.destroy();
```

## Events

### tour:started

Fired when a tour begins.

```javascript
BotBuilderTours.on('tour:started', (data) => {
  console.log('Tour ID:', data.tourId);
  console.log('Tour:', data.tour);
});
```

### tour:completed

Fired when a tour is completed (all steps finished).

```javascript
BotBuilderTours.on('tour:completed', (data) => {
  console.log('Tour completed:', data.tourId);
  console.log('Steps completed:', data.stepsCompleted);
});
```

### tour:dismissed

Fired when a tour is skipped/dismissed.

```javascript
BotBuilderTours.on('tour:dismissed', (data) => {
  console.log('Tour dismissed:', data.tourId);
  console.log('Dismissed at step:', data.atStep);
});
```

### step:viewed

Fired when a step is displayed.

```javascript
BotBuilderTours.on('step:viewed', (data) => {
  console.log('Step index:', data.stepIndex);
  console.log('Step:', data.step);
  console.log('Progress:', data.progress); // 0.0 to 1.0
});
```

### step:completed

Fired when a step is completed (user clicks next).

```javascript
BotBuilderTours.on('step:completed', (data) => {
  console.log('Completed step:', data.stepIndex);
  console.log('Step data:', data.step);
});
```

### user:identified

Fired when identify() is called.

```javascript
BotBuilderTours.on('user:identified', (data) => {
  console.log('User:', data.userId);
  console.log('Traits:', data.traits);
});
```

### error

Fired when an error occurs.

```javascript
BotBuilderTours.on('error', (data) => {
  console.error('Error type:', data.type);
  console.error('Error:', data.error);
});
```

### initialized

Fired when SDK is initialized.

```javascript
BotBuilderTours.on('initialized', (config) => {
  console.log('SDK initialized with config:', config);
});
```

### destroyed

Fired when SDK is destroyed.

```javascript
BotBuilderTours.on('destroyed', () => {
  console.log('SDK destroyed');
});
```

## Keyboard Navigation

The SDK supports full keyboard navigation:

| Key | Action |
|-----|--------|
| `Enter` | Next step |
| `→` (Right Arrow) | Next step |
| `←` (Left Arrow) | Previous step |
| `Escape` | Skip tour (if dismissible) |
| `Tab` | Navigate between buttons |

## Accessibility

The SDK includes built-in accessibility features:

- **ARIA attributes**: All elements have appropriate roles and labels
- **Focus management**: Focus is trapped in modals, returns after tour ends
- **Screen reader support**: Step changes are announced
- **Keyboard navigation**: Full keyboard support
- **High contrast**: Works with high contrast modes

## Customization

### CSS Variables

Override default styles using CSS:

```css
/* Override tooltip styles */
.bb-tour-tooltip {
  --bb-primary-color: #your-color;
  background: #your-background;
  border-radius: 12px;
}

/* Override button styles */
.bb-tour-actions .btn-primary {
  background: #your-color;
}

/* Override overlay */
.bb-tour-overlay {
  background: rgba(0, 0, 0, 0.7);
}
```

### Theme via API

Set theme when creating a tour:

```javascript
// Via API
POST /api/tours
{
  "name": "My Tour",
  "theme": {
    "primaryColor": "#3B82F6",
    "backgroundColor": "#FFFFFF",
    "textColor": "#1F2937",
    "borderRadius": 8
  }
}
```

## Error Handling

### Element Not Found

When a target element isn't found, the SDK will:
1. Log a warning to console
2. Automatically skip to the next step
3. Emit an error event

```javascript
BotBuilderTours.on('error', (data) => {
  if (data.type === 'element_not_found') {
    console.warn('Element not found:', data.selector);
  }
});
```

### API Failures

Handle API failures gracefully:

```javascript
BotBuilderTours.startTour('tour-id')
  .catch(error => {
    // Show fallback UI or retry
    showFallbackOnboarding();
  });
```

### Retry Logic

Events are queued and retried automatically on network failure.

## Storage

The SDK uses localStorage to persist:

- **Visitor ID**: `bb_tours_visitor_id`
- **Tour Progress**: `bb_tours_progress_{tourId}`
- **Completed Tours**: `bb_tours_completed_{tourId}`
- **Dismissed Tours**: `bb_tours_dismissed_{tourId}`

Clear storage:

```javascript
localStorage.removeItem('bb_tours_progress_tour-id');
localStorage.removeItem('bb_tours_completed_tour-id');
```

## Examples

### Basic Onboarding Tour

```javascript
BotBuilderTours.init({
  workspaceId: 'your-workspace-id'
});

// Start tour when user first visits
if (!localStorage.getItem('onboarding_completed')) {
  BotBuilderTours.startTour('onboarding');

  BotBuilderTours.on('tour:completed', () => {
    localStorage.setItem('onboarding_completed', 'true');
  });
}
```

### Feature Announcement

```javascript
// Start tour when feature flag is enabled
if (featureFlags.newFeature) {
  BotBuilderTours.startTour('new-feature-tour');
}
```

### Trigger on Button Click

```javascript
document.getElementById('help-btn').addEventListener('click', () => {
  BotBuilderTours.startTour('help-tour');
});
```

### With Analytics Integration

```javascript
BotBuilderTours.on('tour:completed', (data) => {
  analytics.track('Tour Completed', {
    tourId: data.tourId,
    stepsCompleted: data.stepsCompleted
  });
});

BotBuilderTours.on('tour:dismissed', (data) => {
  analytics.track('Tour Dismissed', {
    tourId: data.tourId,
    atStep: data.atStep
  });
});
```

### React Integration

```jsx
import { useEffect } from 'react';

function App() {
  useEffect(() => {
    // Initialize SDK
    window.BotBuilderTours.init({
      workspaceId: 'your-workspace-id'
    });

    return () => {
      window.BotBuilderTours.destroy();
    };
  }, []);

  const startTour = () => {
    window.BotBuilderTours.startTour('dashboard-tour');
  };

  return (
    <button onClick={startTour}>
      Start Tour
    </button>
  );
}
```

### Vue Integration

```vue
<template>
  <button @click="startTour">Start Tour</button>
</template>

<script>
export default {
  mounted() {
    window.BotBuilderTours.init({
      workspaceId: 'your-workspace-id'
    });
  },
  beforeUnmount() {
    window.BotBuilderTours.destroy();
  },
  methods: {
    startTour() {
      window.BotBuilderTours.startTour('dashboard-tour');
    }
  }
};
</script>
```

## Browser Support

- Chrome 60+
- Firefox 55+
- Safari 11+
- Edge 79+
- iOS Safari 11+
- Android Chrome 60+

## Bundle Size

- Minified: ~25KB
- Gzipped: ~8KB

## Changelog

### v1.0.0
- Initial release
- Tooltip, Modal, Hotspot, Slideout step types
- Keyboard navigation
- Accessibility support
- Event system
- Progress persistence
- Analytics tracking

## Support

- Documentation: https://docs.botbuilder.app/tours
- GitHub Issues: https://github.com/botbuilder/tours-sdk/issues
- Email: support@botbuilder.app
