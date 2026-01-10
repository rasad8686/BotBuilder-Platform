# BotBuilder A/B Test SDK Documentation

## Overview

The BotBuilder A/B Test SDK enables you to easily implement A/B testing in your web applications. It supports both React applications and vanilla JavaScript websites.

## Installation

### React/NPM

```bash
npm install @botbuilder/ab-tests
```

### Script Tag (Vanilla JS)

```html
<script src="https://cdn.botbuilder.app/ab-test-sdk.js"></script>
```

## Quick Start

### React

```jsx
import { ABTestProvider, useABTest, ABTestButton } from '@botbuilder/ab-tests';

// Wrap your app with the provider
function App() {
  return (
    <ABTestProvider config={{ workspaceId: 'ws_xxx' }}>
      <MyComponent />
    </ABTestProvider>
  );
}

// Use in components
function MyComponent() {
  const { variant, loading, trackConversion } = useABTest('cta_button_test');

  if (loading) return <div>Loading...</div>;

  return (
    <button
      style={{ backgroundColor: variant?.content?.color }}
      onClick={() => {
        trackConversion('click');
        // your action
      }}
    >
      {variant?.content?.text || 'Get Started'}
    </button>
  );
}
```

### Vanilla JavaScript

```html
<script src="https://cdn.botbuilder.app/ab-test-sdk.js"></script>
<script>
  // Initialize
  BotBuilderABTest.init({
    workspaceId: 'ws_xxx',
    userId: 'user_123', // optional
  });

  // Get variant
  async function setupTest() {
    const variant = await BotBuilderABTest.getVariant('cta_button_test');

    const button = document.getElementById('cta-button');
    button.style.backgroundColor = variant.content.color;
    button.textContent = variant.content.text;

    button.onclick = () => {
      BotBuilderABTest.trackConversion('cta_button_test', { type: 'click' });
    };
  }

  setupTest();
</script>
```

## API Reference

### ABTestSDK

#### `init(config)`

Initialize the SDK.

```javascript
ABTestSDK.init({
  workspaceId: 'ws_xxx',      // Required
  userId: 'user_123',          // Optional
  visitorId: 'custom_id',      // Optional (auto-generated)
  apiUrl: 'https://...',       // Optional
  debug: true,                 // Optional
});
```

#### `identify(userId, traits)`

Identify a user for targeted testing.

```javascript
ABTestSDK.identify('user_123', {
  plan: 'premium',
  country: 'US',
  signupDate: '2024-01-15',
});
```

#### `getVariant(testId, options)`

Get the assigned variant for a test.

```javascript
const variant = await ABTestSDK.getVariant('test_id');
// Returns: { testId, variantId, variantName, content }

// Force refresh
const variant = await ABTestSDK.getVariant('test_id', { forceRefresh: true });
```

#### `trackConversion(testId, options)`

Track a conversion event.

```javascript
// Simple goal tracking
await ABTestSDK.trackConversion('test_id');

// With options
await ABTestSDK.trackConversion('test_id', {
  type: 'purchase',      // click, signup, purchase, custom
  value: 99.99,          // For revenue tracking
  metadata: { sku: '123' }
});
```

#### `on(event, callback)`

Listen to SDK events.

```javascript
ABTestSDK.on('variant:assigned', (data) => {
  console.log('Variant assigned:', data);
});

ABTestSDK.on('conversion:tracked', (data) => {
  console.log('Conversion:', data);
});

ABTestSDK.on('error', (error) => {
  console.error('Error:', error);
});
```

#### `getState()`

Get current SDK state.

```javascript
const state = ABTestSDK.getState();
// { initialized, visitorId, userId, assignmentCount }
```

#### `clearAssignments(testId?)`

Clear cached assignments.

```javascript
// Clear all
ABTestSDK.clearAssignments();

// Clear specific test
ABTestSDK.clearAssignments('test_id');
```

## React Components

### ABTestProvider

Wrap your app to provide SDK context.

```jsx
<ABTestProvider
  config={{
    workspaceId: 'ws_xxx',
    userId: currentUser?.id,
    userTraits: { plan: currentUser?.plan }
  }}
  onInitialized={() => console.log('Ready')}
  onError={(err) => console.error(err)}
>
  <App />
</ABTestProvider>
```

### ABTestVariant

Render different components based on variant.

```jsx
<ABTestVariant
  testId="hero_test"
  variants={{
    A: () => <HeroVersionA />,
    B: () => <HeroVersionB />,
  }}
  fallback={<DefaultHero />}
  loadingComponent={<Skeleton />}
/>
```

### ABTestShow / ABTestHide

Conditionally show/hide content.

```jsx
// Show only for variant B
<ABTestShow testId="feature_test" variant="B">
  <NewFeature />
</ABTestShow>

// Hide for variant A
<ABTestHide testId="feature_test" variant="A">
  <ExperimentalFeature />
</ABTestHide>
```

### ABTestButton

Pre-built A/B tested button.

```jsx
<ABTestButton
  testId="cta_test"
  onClick={handleClick}
  trackClick={true}
>
  Default Text
</ABTestButton>
```

### ABTestMessage

A/B tested text content.

```jsx
<ABTestMessage
  testId="welcome_message"
  defaultMessage="Welcome!"
  as="h1"
/>
```

### ABTestHero

Complete A/B tested hero section.

```jsx
<ABTestHero
  testId="landing_hero"
  defaults={{
    title: 'Welcome',
    subtitle: 'Get started today',
    ctaText: 'Sign Up'
  }}
  onCtaClick={() => navigate('/signup')}
/>
```

## React Hooks

### useABTest

Main hook for A/B testing.

```jsx
const {
  variant,        // Full variant object
  variantId,      // Variant ID
  variantName,    // Variant name (A, B, etc.)
  content,        // Variant content
  loading,        // Loading state
  error,          // Error if any
  trackConversion,// Track conversion function
  isControl,      // Is control variant
} = useABTest('test_id', {
  enabled: true,      // Enable/disable
  forceRefresh: false // Force API refresh
});
```

### useABTestVariant

Get variant content with defaults.

```jsx
const { content, variantName, loading } = useABTestVariant(
  'test_id',
  { text: 'Default', color: '#000' } // defaults
);
```

### useABTestImpression

Track when element is viewed.

```jsx
const { ref, viewed } = useABTestImpression('test_id', {
  threshold: 0.5,  // 50% visible
  trackOnce: true  // Track only once
});

return <div ref={ref}>Content</div>;
```

### useABTests

Get multiple test variants at once.

```jsx
const { variants, loading, errors } = useABTests([
  'test_1',
  'test_2',
  'test_3'
]);
```

## Best Practices

### 1. Initialize Early

Initialize the SDK as early as possible to minimize loading states.

```jsx
// In your app entry point
useEffect(() => {
  ABTestSDK.init({ workspaceId: 'ws_xxx' });
}, []);
```

### 2. Handle Loading States

Always handle loading states to prevent layout shifts.

```jsx
if (loading) {
  return <Skeleton />;
}
```

### 3. Track Meaningful Conversions

Track conversions that align with your business goals.

```javascript
// Good - specific action
trackConversion('signup');
trackConversion('purchase', { value: 99.99 });

// Avoid - too generic
trackConversion('click');
```

### 4. Use Fallbacks

Always provide fallback content for errors.

```jsx
<ABTestVariant
  testId="test"
  variants={{ A: ComponentA, B: ComponentB }}
  fallback={<DefaultComponent />} // Important!
/>
```

### 5. Clean Up

Destroy SDK when component unmounts if using outside Provider.

```jsx
useEffect(() => {
  ABTestSDK.init(config);
  return () => ABTestSDK.destroy();
}, []);
```

## Events

| Event | Description |
|-------|-------------|
| `sdk:initialized` | SDK initialized successfully |
| `user:identified` | User identified |
| `variant:assigned` | Variant assigned to visitor |
| `conversion:tracked` | Conversion tracked |
| `error` | Error occurred |

## TypeScript Support

Full TypeScript definitions are included.

```typescript
import type {
  TourConfig,
  Variant,
  ConversionOptions
} from '@botbuilder/ab-tests';
```

## Browser Support

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## Troubleshooting

### Variant not loading

1. Check if SDK is initialized
2. Verify workspaceId is correct
3. Check browser console for errors

### Conversions not tracking

1. Ensure variant was assigned first
2. Check network requests in DevTools
3. Verify testId matches

### Cache issues

Clear assignments to get fresh variants:

```javascript
ABTestSDK.clearAssignments();
```

## Support

- GitHub Issues: https://github.com/botbuilder/ab-test-sdk/issues
- Documentation: https://docs.botbuilder.app/ab-testing
- Email: support@botbuilder.app
