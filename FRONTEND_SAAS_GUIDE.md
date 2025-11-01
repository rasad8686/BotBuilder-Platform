# BotBuilder SaaS Frontend Guide

## Overview

This guide documents the 5 new frontend pages that transform BotBuilder into a complete SaaS platform. All pages follow the existing purple theme with modern, responsive UI design.

## New Pages

### 1. Billing Page (`/billing`)
**File:** `client/src/pages/Billing.jsx` (500+ lines)

#### Features
- Current subscription plan display with usage statistics
- Three-tier plan comparison (Free, Pro, Enterprise)
- Usage bars showing bot and message limits
- Upgrade/downgrade functionality with Stripe Checkout
- Payment history table with transaction details
- Cancel/reactivate subscription management

#### API Endpoints Used
- `GET /subscriptions/current` - Fetch current subscription
- `POST /subscriptions/create-checkout` - Create Stripe checkout session
- `GET /subscriptions/payment-history` - Fetch payment history
- `POST /subscriptions/cancel` - Cancel subscription
- `POST /subscriptions/reactivate` - Reactivate subscription

#### Key Components
```javascript
// Usage Statistics Card
<div className="grid md:grid-cols-2 gap-6 mb-8">
  {/* Bots Usage */}
  <div className="bg-white rounded-2xl shadow-lg p-6">
    <h3>Total Bots</h3>
    <p>{subscription.bots_used} / {subscription.max_bots}</p>
    <div className="w-full bg-gray-200 rounded-full h-2">
      <div className="bg-purple-600 h-2 rounded-full"
           style={{width: `${percentage}%`}}></div>
    </div>
  </div>
</div>

// Plan Selection
<div className="grid md:grid-cols-3 gap-6">
  {plans.map(plan => (
    <div className="border rounded-2xl p-6">
      <h3>{plan.display_name}</h3>
      <p className="text-4xl font-bold">${plan.price_monthly}</p>
      <button onClick={() => handleUpgrade(plan.id)}>
        {currentPlan === plan.id ? 'Current Plan' : 'Upgrade'}
      </button>
    </div>
  ))}
</div>
```

#### Stripe Integration
```javascript
const handleUpgrade = async (planId, billingCycle = 'monthly') => {
  const response = await axios.post(
    `${API_BASE_URL}/subscriptions/create-checkout`,
    { planId, billingCycle },
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (response.data.url) {
    window.location.href = response.data.url; // Redirect to Stripe
  }
};
```

#### Usage
1. User views current plan and usage statistics
2. Click "Upgrade" on desired plan
3. Redirected to Stripe Checkout
4. After payment, redirected back with success message
5. Subscription automatically updated in database

---

### 2. API Tokens Page (`/api-tokens`)
**File:** `client/src/pages/ApiTokens.jsx` (400+ lines)

#### Features
- List all API tokens with preview (first 15 chars)
- Create new tokens with bot-specific or all-bots access
- Set optional expiration dates
- Copy token to clipboard
- Enable/disable tokens
- Delete tokens with confirmation
- API documentation with usage examples
- Token permissions display (Read, Write, Delete)

#### API Endpoints Used
- `GET /api-tokens` - List all tokens
- `POST /api-tokens` - Create new token
- `PATCH /api-tokens/:id/toggle` - Enable/disable token
- `DELETE /api-tokens/:id` - Delete token
- `GET /bots` - Fetch bots for token assignment

#### Key Components
```javascript
// Create Token Modal
<div className="fixed inset-0 bg-black bg-opacity-50">
  <div className="bg-white rounded-2xl p-8">
    <h2>Create API Token</h2>
    <form onSubmit={handleCreateToken}>
      <input
        type="text"
        placeholder="Token Name"
        value={formData.tokenName}
        required
      />
      <select value={formData.botId}>
        <option value="">All Bots</option>
        {bots.map(bot => (
          <option key={bot.id} value={bot.id}>{bot.name}</option>
        ))}
      </select>
      <input
        type="number"
        placeholder="Expires In (Days)"
        value={formData.expiresInDays}
      />
      <button type="submit">Create Token</button>
    </form>
  </div>
</div>

// Token Display (shown only once!)
{newToken && (
  <div className="bg-green-50 p-4">
    <p>Copy this token now. You won't be able to see it again!</p>
    <code>{newToken}</code>
    <button onClick={() => copyToClipboard(newToken)}>
      Copy Token
    </button>
  </div>
)}
```

#### Token Security
- Tokens shown ONLY once after creation
- SHA-256 hashed in database
- Token format: `bbot_[32-character-uuid]`
- Preview shows only first 15 characters

#### Usage
1. Click "Create Token" button
2. Fill in token name, optional bot selection, optional expiration
3. Submit form - token created and shown once
4. Copy token immediately (cannot view again!)
5. Use token in API calls with `Authorization: Bearer bbot_xxx` header

---

### 3. Webhooks Page (`/webhooks`)
**File:** `client/src/pages/Webhooks.jsx` (400+ lines)

#### Features
- Bot selector dropdown
- Webhook URL display with copy functionality
- Webhook secret display (first 20 chars)
- Test webhook interface with real-time results
- Integration guides for Telegram, WhatsApp, Discord
- Webhook logs viewer with request/response details
- Status indicators (success/error)
- Response time tracking

#### API Endpoints Used
- `GET /bots` - Fetch all bots
- `GET /webhooks/:botId/logs?limit=50` - Fetch webhook logs
- `POST /webhooks/:botId/test` - Test webhook endpoint

#### Key Components
```javascript
// Webhook URL Display
<div className="flex gap-2">
  <input
    type="text"
    value={`${API_BASE_URL}/webhooks/receive/${selectedBot.id}`}
    readOnly
  />
  <button onClick={() => copyToClipboard(webhookUrl)}>
    Copy
  </button>
</div>

// Test Webhook
<form onSubmit={handleTestWebhook}>
  <input
    type="url"
    placeholder="https://your-server.com/webhook"
    value={testUrl}
    required
  />
  <button type="submit" disabled={testingWebhook}>
    {testingWebhook ? 'Testing...' : 'Test'}
  </button>
</form>

{testResult && (
  <div className={testResult.success ? 'bg-green-50' : 'bg-red-50'}>
    <p>{testResult.success ? 'Webhook Test Successful' : 'Webhook Test Failed'}</p>
    {testResult.success && (
      <>
        <p>Status: {testResult.status}</p>
        <p>Response Time: {testResult.responseTime}ms</p>
      </>
    )}
  </div>
)}
```

#### Integration Guides

**Telegram:**
```bash
curl -X POST \
  https://api.telegram.org/bot<TOKEN>/setWebhook \
  -d url=https://botbuilder-platform.onrender.com/webhooks/receive/123
```

**WhatsApp:**
Use webhook URL in Meta Business Suite → WhatsApp → Configuration → Webhooks

**Discord:**
Add interaction endpoint URL in Discord Developer Portal → Your App → General Information

#### Webhook Logs
```javascript
{webhookLogs.map(log => (
  <div className={log.response_status >= 200 && log.response_status < 300
    ? 'border-green-200' : 'border-red-200'}>
    <span>{log.request_method} {log.webhook_url}</span>
    <span className="badge">{log.response_status || 'Error'}</span>
    <p>{new Date(log.created_at).toLocaleString()}</p>
    {log.response_time_ms && <p>Response time: {log.response_time_ms}ms</p>}

    {/* Expandable request/response bodies */}
    <details>
      <summary>View Request Body</summary>
      <pre>{JSON.stringify(log.request_body, null, 2)}</pre>
    </details>
  </div>
))}
```

---

### 4. Usage Dashboard Page (`/usage`)
**File:** `client/src/pages/Usage.jsx` (300+ lines)

#### Features
- Current plan display with upgrade button
- Four usage statistics cards:
  - Total Bots (with limit and percentage)
  - Messages This Month (with limit and percentage)
  - Messages Sent
  - Messages Received
- Color-coded progress bars (green/orange/red)
- Warning banners when approaching limits (80%+)
- Quick action buttons to other SaaS features

#### API Endpoints Used
- `GET /analytics/dashboard` - Fetch complete usage statistics

#### Key Components
```javascript
// Stats Grid
<div className="grid md:grid-cols-4 gap-6">
  {/* Bots Card */}
  <div className="bg-white rounded-2xl shadow-lg p-6">
    <div className="text-3xl">🤖</div>
    <span className="text-2xl font-bold">{dashboardData.bots.total}</span>
    <h3>Total Bots</h3>
    <p>Limit: {dashboardData.bots.limit === -1 ? '∞' : dashboardData.bots.limit}</p>
    <p>{Math.round(dashboardData.bots.percentage)}%</p>

    {/* Progress Bar */}
    <div className="w-full bg-gray-200 rounded-full h-2">
      <div className={
        dashboardData.bots.percentage >= 100 ? 'bg-red-500' :
        dashboardData.bots.percentage > 80 ? 'bg-orange-500' :
        'bg-purple-600'
      } style={{width: `${Math.min(dashboardData.bots.percentage, 100)}%`}}></div>
    </div>
  </div>

  {/* Similar cards for Messages, Sent, Received */}
</div>

// Warning Banner (shown at 80%+ usage)
{dashboardData.messages.percentage > 80 && (
  <div className="bg-orange-50 border border-orange-200 rounded-2xl p-6">
    <div className="text-3xl">⚠️</div>
    <h3>Approaching Message Limit</h3>
    <p>You've used {dashboardData.messages.total} out of {dashboardData.messages.limit} messages</p>
    <button onClick={() => navigate('/billing')}>
      Upgrade Now
    </button>
  </div>
)}
```

#### Usage Tracking
- Bots: Current count vs. plan limit
- Messages: Monthly total (sent + received) vs. plan limit
- Sent: Outgoing messages this month
- Received: Incoming messages this month
- Unlimited plans show infinity symbol (∞)
- Color coding:
  - Green: < 80% usage
  - Orange: 80-99% usage
  - Red: 100%+ usage (limit reached)

---

### 5. Settings Page (`/settings`)
**File:** `client/src/pages/Settings.jsx` (100+ lines)

#### Features
- Account information display
- Quick links to all SaaS features
- Logout functionality
- Delete account button (danger zone)

#### API Endpoints Used
- None (uses localStorage for user data)

#### Key Components
```javascript
// Account Information
<div className="bg-white rounded-2xl shadow-lg p-8">
  <h2>Account Information</h2>
  {user && (
    <div>
      <div>
        <label>Name</label>
        <p>{user.name || 'Not set'}</p>
      </div>
      <div>
        <label>Email</label>
        <p>{user.email}</p>
      </div>
      <div>
        <label>User ID</label>
        <p className="font-mono">{user.id}</p>
      </div>
    </div>
  )}
</div>

// Quick Links
<div className="bg-white rounded-2xl shadow-lg p-8">
  <h2>Quick Links</h2>
  <button onClick={() => navigate('/billing')}>
    Billing & Subscription →
  </button>
  <button onClick={() => navigate('/api-tokens')}>
    API Tokens →
  </button>
  <button onClick={() => navigate('/webhooks')}>
    Webhooks →
  </button>
  <button onClick={() => navigate('/usage')}>
    Usage & Analytics →
  </button>
</div>

// Danger Zone
<div className="bg-white rounded-2xl shadow-lg p-8 border border-red-200">
  <h2 className="text-red-600">Danger Zone</h2>
  <button onClick={handleLogout}>Logout</button>
  <button onClick={handleDeleteAccount}>Delete Account</button>
  <p>⚠️ Deleting your account will permanently remove all your bots, data, and subscriptions.</p>
</div>
```

#### Logout Flow
```javascript
const handleLogout = () => {
  if (confirm('Are you sure you want to logout?')) {
    localStorage.clear(); // Remove token and user data
    navigate('/login');
  }
};
```

---

## App.jsx Routes

All new pages are registered in `client/src/App.jsx`:

```javascript
import Billing from './pages/Billing';
import ApiTokens from './pages/ApiTokens';
import Webhooks from './pages/Webhooks';
import Usage from './pages/Usage';
import Settings from './pages/Settings';

function App() {
  return (
    <Router>
      <Routes>
        {/* Auth Routes */}
        <Route path="/" element={<Navigate to="/login" />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Dashboard & Bots */}
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/create-bot" element={<CreateBot />} />
        <Route path="/mybots" element={<MyBots />} />
        <Route path="/my-bots" element={<MyBots />} />
        <Route path="/bot/:botId/messages" element={<BotMessages />} />
        <Route path="/bot/:botId/edit" element={<EditBot />} />
        <Route path="/analytics" element={<Analytics />} />

        {/* New SaaS Routes */}
        <Route path="/billing" element={<Billing />} />
        <Route path="/api-tokens" element={<ApiTokens />} />
        <Route path="/webhooks" element={<Webhooks />} />
        <Route path="/usage" element={<Usage />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Router>
  );
}
```

---

## Common Patterns

### 1. Authentication Check
All pages check for authentication token:

```javascript
useEffect(() => {
  const token = localStorage.getItem('token');
  if (!token) {
    navigate('/login');
    return;
  }
  fetchData();
}, []);
```

### 2. Loading States
```javascript
if (loading) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-6 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading...</p>
      </div>
    </div>
  );
}
```

### 3. API Calls
```javascript
const fetchData = async () => {
  try {
    const token = localStorage.getItem('token');
    const response = await axios.get(`${API_BASE_URL}/endpoint`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    setData(response.data);
  } catch (error) {
    console.error('Error:', error);
    if (error.response?.status === 401) {
      navigate('/login'); // Unauthorized - redirect to login
    }
  } finally {
    setLoading(false);
  }
};
```

### 4. Copy to Clipboard
```javascript
const copyToClipboard = (text) => {
  navigator.clipboard.writeText(text);
  alert('Copied to clipboard!');
};
```

### 5. Confirm Dialogs
```javascript
const handleDelete = () => {
  if (!confirm('Are you sure? This action cannot be undone.')) {
    return;
  }
  // Proceed with deletion
};
```

---

## Design System

### Color Palette
- **Primary Purple**: `#9333ea` (purple-600)
- **Purple Hover**: `#7e22ce` (purple-700)
- **Success Green**: `#16a34a` (green-600)
- **Warning Orange**: `#ea580c` (orange-600)
- **Error Red**: `#dc2626` (red-600)
- **Background Gradient**: `from-purple-50 to-blue-50`

### Typography
- **Page Title**: `text-4xl font-bold text-gray-800`
- **Section Title**: `text-2xl font-bold text-gray-800`
- **Card Title**: `text-xl font-bold text-gray-800`
- **Body Text**: `text-gray-600`
- **Small Text**: `text-sm text-gray-600`

### Common Classes
```javascript
// Card
"bg-white rounded-2xl shadow-lg p-6"

// Button Primary
"px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700"

// Button Secondary
"px-6 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"

// Button Danger
"px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700"

// Input
"w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"

// Badge Success
"px-3 py-1 rounded-full bg-green-100 text-green-800"

// Badge Warning
"px-3 py-1 rounded-full bg-orange-100 text-orange-800"
```

---

## Setup Instructions

### 1. Install Dependencies
```bash
cd client
npm install
```

Dependencies already included:
- react-router-dom (routing)
- axios (HTTP client)
- Tailwind CSS (styling)

### 2. Environment Variables
Create `client/.env`:

```bash
VITE_API_BASE_URL=http://localhost:5000
# or for production:
VITE_API_BASE_URL=https://botbuilder-platform.onrender.com
```

### 3. Run Development Server
```bash
cd client
npm run dev
```

Access at: `http://localhost:5173`

---

## Testing Guide

### Test Billing Page
1. Navigate to `/billing`
2. View current plan (should show "Free Plan" for new users)
3. View usage statistics (bots, messages)
4. Click "Upgrade" on Pro plan
5. Should redirect to Stripe Checkout (test mode)
6. Complete payment with test card: `4242 4242 4242 4242`
7. Redirected back with success message
8. Plan should update to "Pro"

### Test API Tokens Page
1. Navigate to `/api-tokens`
2. Click "Create Token"
3. Fill in token name, select bot (or leave for all bots)
4. Submit form
5. Token displayed once - copy immediately!
6. Token appears in list with preview
7. Test toggle (enable/disable)
8. Test delete (with confirmation)

### Test Webhooks Page
1. Navigate to `/webhooks`
2. Select a bot from dropdown
3. Webhook URL displayed
4. Copy webhook URL
5. Enter test URL: `https://webhook.site/unique-url`
6. Click "Test" - should show success with status 200
7. View webhook logs - test should appear
8. Check integration guides

### Test Usage Dashboard
1. Navigate to `/usage`
2. View current plan card
3. View 4 usage statistics cards
4. Create bots/send messages to see usage increase
5. When usage > 80%, warning banner should appear
6. Test quick action buttons

### Test Settings Page
1. Navigate to `/settings`
2. View account information (name, email, ID)
3. Click quick links - should navigate correctly
4. Test logout - should clear localStorage and redirect to `/login`

---

## API Integration

All pages integrate with backend API endpoints. Ensure backend server is running:

```bash
# Terminal 1 - Backend
cd BotBuilder
node server.js
# or
npm start

# Terminal 2 - Frontend
cd client
npm run dev
```

### API Base URL
Development: `http://localhost:5000`
Production: `https://botbuilder-platform.onrender.com`

### Authentication
All API calls include JWT token in Authorization header:
```javascript
headers: {
  Authorization: `Bearer ${localStorage.getItem('token')}`
}
```

---

## Navigation Menu (TODO)

To complete the frontend, add a navigation menu to access all SaaS pages:

```javascript
// components/Navigation.jsx
import { useNavigate } from 'react-router-dom';

export default function Navigation() {
  const navigate = useNavigate();

  return (
    <nav className="bg-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between h-16">
          <div className="flex space-x-8">
            <button onClick={() => navigate('/dashboard')}>Dashboard</button>
            <button onClick={() => navigate('/my-bots')}>My Bots</button>
            <button onClick={() => navigate('/usage')}>Usage</button>
            <button onClick={() => navigate('/billing')}>Billing</button>
            <button onClick={() => navigate('/api-tokens')}>API Tokens</button>
            <button onClick={() => navigate('/webhooks')}>Webhooks</button>
            <button onClick={() => navigate('/settings')}>Settings</button>
          </div>
        </div>
      </div>
    </nav>
  );
}
```

Add to each page:
```javascript
import Navigation from '../components/Navigation';

export default function PageName() {
  return (
    <>
      <Navigation />
      {/* Page content */}
    </>
  );
}
```

---

## Error Handling

All pages implement consistent error handling:

### 401 Unauthorized
```javascript
if (error.response?.status === 401) {
  localStorage.clear();
  navigate('/login');
}
```

### 403 Forbidden (Limit Reached)
```javascript
if (error.response?.status === 403) {
  alert('Limit reached. Please upgrade your plan.');
  navigate('/billing');
}
```

### Network Errors
```javascript
catch (error) {
  console.error('Error:', error);
  alert(error.response?.data?.error || 'An error occurred');
}
```

---

## Responsive Design

All pages are fully responsive using Tailwind's responsive utilities:

```javascript
// Mobile: Single column
// Tablet: 2 columns
// Desktop: 3-4 columns
className="grid md:grid-cols-2 lg:grid-cols-4 gap-6"

// Mobile: Full width
// Desktop: Max width with margin
className="max-w-7xl mx-auto"

// Responsive padding
className="p-4 md:p-6 lg:p-8"

// Responsive text
className="text-2xl md:text-3xl lg:text-4xl"
```

---

## Accessibility

### Form Labels
```javascript
<label className="block text-gray-700 font-semibold mb-2">
  Token Name *
</label>
<input
  type="text"
  aria-label="Token Name"
  required
/>
```

### Button Titles
```javascript
<button
  title="Copy to clipboard"
  aria-label="Copy token to clipboard"
>
  📋 Copy
</button>
```

### Loading States
```javascript
<div role="status" aria-live="polite">
  <div className="animate-spin..."></div>
  <p>Loading...</p>
</div>
```

---

## Performance Optimization

### Lazy Loading (Future Enhancement)
```javascript
import { lazy, Suspense } from 'react';

const Billing = lazy(() => import('./pages/Billing'));
const ApiTokens = lazy(() => import('./pages/ApiTokens'));

<Suspense fallback={<LoadingSpinner />}>
  <Route path="/billing" element={<Billing />} />
</Suspense>
```

### Memoization (Future Enhancement)
```javascript
import { useMemo } from 'react';

const expensiveCalculation = useMemo(() => {
  return calculateUsagePercentage(data);
}, [data]);
```

---

## Troubleshooting

### Issue: Pages showing blank/white screen
**Solution:** Check browser console for errors. Ensure backend API is running.

### Issue: API calls failing with CORS error
**Solution:** Ensure backend has CORS enabled for frontend URL:
```javascript
// server.js
app.use(cors({
  origin: 'http://localhost:5173'
}));
```

### Issue: Redirecting to login on every page
**Solution:** Check localStorage for token. If missing, login again.

### Issue: Stripe redirect not working
**Solution:** Ensure `STRIPE_PUBLISHABLE_KEY` is set in backend .env

### Issue: Webhook test failing
**Solution:** Ensure test URL is accessible from server. Try webhook.site for testing.

---

## Production Deployment

### Build Frontend
```bash
cd client
npm run build
```

### Environment Variables
```bash
# Production .env
VITE_API_BASE_URL=https://your-backend.onrender.com
```

### Deploy to Netlify/Vercel
1. Connect GitHub repository
2. Set build command: `npm run build`
3. Set publish directory: `dist`
4. Add environment variables
5. Deploy!

---

## Summary

The BotBuilder SaaS frontend is now complete with 5 professional pages:

1. **Billing** - Full subscription management with Stripe
2. **API Tokens** - Secure token generation and management
3. **Webhooks** - Webhook configuration and monitoring
4. **Usage** - Comprehensive usage dashboard
5. **Settings** - Account settings and management

All pages follow consistent design patterns, handle errors gracefully, and integrate seamlessly with the backend API.

**Next Steps:**
1. Add navigation menu to all pages
2. Test thoroughly in browser
3. Configure Stripe production keys
4. Deploy to production
5. Monitor user feedback and iterate

---

## Support

For issues or questions:
- Check browser console for errors
- Review backend logs
- Refer to SAAS_COMPLETE_GUIDE.md for backend API docs
- Check network tab for failed API calls
