# Product Tours System

Interactive product tours and onboarding flows for BotBuilder platform.

## Overview

The Product Tours system allows you to create guided tours to onboard users, highlight features, and improve user engagement. Tours consist of steps that can be tooltips, modals, hotspots, or slideouts.

## Features

- **Multiple Step Types**: Tooltip, Modal, Hotspot, Slideout, Driven Action
- **Flexible Positioning**: Auto, Top, Bottom, Left, Right, Center
- **Targeting Rules**: URL-based, User properties, Events, Segments
- **Analytics**: Track impressions, completions, drop-offs
- **Progress Tracking**: Resume tours from where users left off
- **Customizable Themes**: Colors, border radius, overlay opacity
- **Accessibility**: Keyboard navigation, screen reader support
- **Lightweight SDK**: <50KB gzipped

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      Client Side                         │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │   Admin UI   │  │  Tours SDK  │  │  React Components│ │
│  │ (Dashboard)  │  │  (Public)   │  │  (Tour Builder)  │ │
│  └──────┬──────┘  └──────┬──────┘  └────────┬────────┘  │
└─────────┼────────────────┼──────────────────┼───────────┘
          │                │                  │
          ▼                ▼                  ▼
┌─────────────────────────────────────────────────────────┐
│                      API Layer                           │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐│
│  │              tour.routes.js                          ││
│  │  GET/POST /api/tours                                ││
│  │  GET/PUT/DELETE /api/tours/:id                      ││
│  │  POST /api/tours/:id/publish|pause|archive          ││
│  │  CRUD /api/tours/:id/steps                          ││
│  │  GET/PUT /api/tours/:id/targeting                   ││
│  │  GET /api/tours/:id/analytics                       ││
│  └─────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────┐
│                    Service Layer                         │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐│
│  │              tour.service.js                         ││
│  │  - CRUD Operations                                  ││
│  │  - Duplicate with steps                             ││
│  │  - Status management                                ││
│  │  - Analytics aggregation                            ││
│  │  - Progress tracking                                ││
│  └─────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────┐
│                    Database Layer                        │
├─────────────────────────────────────────────────────────┤
│  tours │ tour_steps │ tour_targeting │ tour_user_progress│
│  tour_analytics │ tour_events                            │
└─────────────────────────────────────────────────────────┘
```

## Database Schema

### tours
Main tour configuration table.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| workspace_id | INT | Reference to workspace |
| name | VARCHAR(255) | Tour name |
| description | TEXT | Tour description |
| status | ENUM | draft, active, paused, archived |
| settings | JSONB | Tour settings (dismissible, progressBar, etc.) |
| theme | JSONB | Visual theme (colors, borderRadius) |
| trigger_type | ENUM | manual, auto, event, delay |
| trigger_config | JSONB | Trigger configuration |
| priority | INT | Display priority (0-100) |
| created_at | TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | Last update timestamp |
| published_at | TIMESTAMP | Publication timestamp |

### tour_steps
Individual steps within a tour.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| tour_id | UUID | Reference to tour |
| step_order | INT | Step sequence number |
| step_type | ENUM | tooltip, modal, hotspot, slideout, driven_action |
| target_selector | VARCHAR(500) | CSS selector for target element |
| title | VARCHAR(255) | Step title |
| content | TEXT | Step content |
| content_type | ENUM | text, html, video |
| position | ENUM | top, bottom, left, right, auto, center |
| alignment | ENUM | start, center, end |
| actions | JSONB | Button actions |
| highlight_element | BOOLEAN | Whether to highlight target |
| scroll_to_element | BOOLEAN | Whether to scroll to target |
| wait_for_event | VARCHAR(100) | Event to wait for before proceeding |

### tour_targeting
Targeting rules for showing tours to specific users.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| tour_id | UUID | Reference to tour |
| target_type | ENUM | url, user_property, event, segment |
| operator | ENUM | equals, contains, starts_with, regex, gt, lt |
| property | VARCHAR(100) | Property name (for user_property) |
| value | TEXT | Value to match |
| logic_operator | ENUM | AND, OR |

### tour_user_progress
Tracks user progress through tours.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| tour_id | UUID | Reference to tour |
| visitor_id | VARCHAR(255) | Anonymous visitor ID |
| user_id | VARCHAR(255) | Authenticated user ID |
| status | ENUM | not_started, in_progress, completed, dismissed |
| current_step | INT | Current step index |
| completed_steps | INT[] | Array of completed step indexes |
| started_at | TIMESTAMP | When user started tour |
| completed_at | TIMESTAMP | When user completed tour |
| last_seen_at | TIMESTAMP | Last interaction timestamp |

### tour_analytics
Daily aggregated analytics.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| tour_id | UUID | Reference to tour |
| date | DATE | Analytics date |
| impressions | INT | Number of views |
| starts | INT | Number of starts |
| completions | INT | Number of completions |
| dismissals | INT | Number of dismissals |
| step_metrics | JSONB | Per-step metrics |
| completion_rate | DECIMAL | Completion percentage |
| avg_time_seconds | INT | Average completion time |

### tour_events
Individual event log for detailed analytics.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| tour_id | UUID | Reference to tour |
| step_id | UUID | Reference to step (nullable) |
| visitor_id | VARCHAR(255) | Visitor ID |
| user_id | VARCHAR(255) | User ID (nullable) |
| event_type | ENUM | tour_started, step_viewed, step_completed, tour_completed, tour_dismissed |
| event_data | JSONB | Additional event data |
| page_url | VARCHAR(2048) | Page where event occurred |
| session_id | VARCHAR(255) | Session identifier |
| created_at | TIMESTAMP | Event timestamp |

## API Endpoints

### Tours

```
GET    /api/tours                    List tours (paginated)
POST   /api/tours                    Create tour
GET    /api/tours/:id                Get tour with steps
PUT    /api/tours/:id                Update tour
DELETE /api/tours/:id                Delete tour
POST   /api/tours/:id/duplicate      Duplicate tour
```

### Status Management

```
POST   /api/tours/:id/publish        Publish tour (draft → active)
POST   /api/tours/:id/pause          Pause tour (active → paused)
POST   /api/tours/:id/archive        Archive tour
```

### Steps

```
GET    /api/tours/:id/steps          List steps
POST   /api/tours/:id/steps          Create step
PUT    /api/tours/:id/steps/:stepId  Update step
DELETE /api/tours/:id/steps/:stepId  Delete step
POST   /api/tours/:id/steps/reorder  Reorder steps
```

### Targeting

```
GET    /api/tours/:id/targeting      Get targeting rules
PUT    /api/tours/:id/targeting      Update targeting rules
```

### Analytics

```
GET    /api/tours/:id/analytics      Tour analytics
GET    /api/tours/analytics/overview Workspace analytics overview
```

## Setup

### 1. Run Migration

```bash
npx knex migrate:latest
```

### 2. Register Routes

In `server/server.js`:

```javascript
const tourRoutes = require('./routes/tour.routes');
app.use('/api/tours', tourRoutes);
```

### 3. Add SDK to Your App

```html
<script src="https://cdn.botbuilder.app/tours-sdk.js"></script>
<script>
  BotBuilderTours.init({
    workspaceId: 'your-workspace-id'
  });
</script>
```

## SDK Usage

See [tours-sdk.md](./tours-sdk.md) for complete SDK documentation.

## Testing

```bash
# Unit tests
npm test -- --grep="tours"

# Integration tests
npm run test:integration -- --grep="tours"

# E2E tests
npx cypress run --spec="**/tours/**"
```

## Error Codes

| Code | Description |
|------|-------------|
| REQUIRED | Required field is missing |
| INVALID_TYPE | Field has wrong type |
| INVALID_VALUE | Field value is not allowed |
| INVALID_FORMAT | Field format is incorrect |
| MAX_LENGTH | Field exceeds max length |
| DUPLICATE | Duplicate value |
| NOT_FOUND | Resource not found |

## Best Practices

1. **Keep tours short** - 3-5 steps maximum
2. **Use clear selectors** - Prefer IDs over complex selectors
3. **Test on different screen sizes** - Ensure responsiveness
4. **Use targeting wisely** - Don't overwhelm users
5. **Monitor analytics** - Iterate based on completion rates
6. **Provide skip option** - Don't force users through tours

## Changelog

### v1.0.0
- Initial release
- Core CRUD operations
- Multiple step types
- Targeting rules
- Analytics tracking
- SDK with accessibility support
