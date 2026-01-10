# Helpdesk/Tickets System

Complete helpdesk and ticket management system for customer support.

## Overview

The Helpdesk/Tickets system provides:
- **Ticket Management** - Create, track, and resolve customer support tickets
- **SLA Tracking** - Monitor response and resolution times with breach alerts
- **Customer Portal** - Public interface for customers to submit and track tickets
- **Automation** - Auto-assignment, canned responses, and workflow triggers
- **Analytics** - Comprehensive reporting and performance metrics

## Features

### Ticket Lifecycle
```
New → Open → Pending → Resolved → Closed
         ↑                    ↓
         ←──── Reopen ←───────
```

### Priority Levels
| Priority | First Response | Resolution Time |
|----------|---------------|-----------------|
| Urgent   | 1 hour        | 4 hours         |
| High     | 4 hours       | 8 hours         |
| Medium   | 8 hours       | 24 hours        |
| Low      | 24 hours      | 72 hours        |

---

## Agent Guide

### Creating Tickets

1. Navigate to **Tickets → New Ticket**
2. Fill in required fields:
   - Subject
   - Description
   - Requester email
   - Priority
   - Category (optional)
3. Click **Create Ticket**

```javascript
// API Example
POST /api/tickets
{
  "subject": "Cannot access my account",
  "description": "I'm getting an error when trying to login",
  "requester_email": "customer@example.com",
  "requester_name": "John Doe",
  "priority": "high",
  "category_id": "uuid-category-id"
}
```

### Managing Tickets

#### Viewing Tickets
- **My Tickets** - Tickets assigned to you
- **Unassigned** - Tickets waiting for assignment
- **All Tickets** - Full ticket queue

#### Filtering Options
- Status: Open, Pending, Resolved, Closed
- Priority: Urgent, High, Medium, Low
- Assignee
- Category
- Date range
- Search by subject/description

#### Ticket Actions
| Action | Description |
|--------|-------------|
| Assign | Assign ticket to an agent |
| Reply | Send response to customer |
| Internal Note | Add note visible only to agents |
| Resolve | Mark ticket as resolved |
| Close | Close resolved ticket |
| Reopen | Reopen closed ticket |
| Merge | Combine duplicate tickets |

### Using Canned Responses

Canned responses save time for common replies.

#### Inserting Canned Response
1. Open ticket reply box
2. Click **Canned Responses** button
3. Select response from list
4. Edit as needed and send

#### Shortcut Method
Type `/` followed by shortcut name:
```
/thanks → "Thank you for contacting us..."
/closing → "I'm closing this ticket. Please reopen if..."
```

#### Creating Canned Responses
1. Go to **Settings → Canned Responses**
2. Click **New Response**
3. Enter:
   - Title
   - Shortcut (e.g., "thanks")
   - Category
   - Content (supports variables)

**Available Variables:**
- `{{customer_name}}` - Customer's name
- `{{ticket_number}}` - Ticket number
- `{{agent_name}}` - Your name

### SLA Compliance

#### Understanding SLA Status
- 🟢 **On Track** - Within SLA targets
- 🟡 **At Risk** - Approaching breach
- 🔴 **Breached** - SLA violated

#### First Response Time
Time from ticket creation to first agent response.

#### Resolution Time
Time from ticket creation to resolved status.

#### Viewing SLA Status
Each ticket shows:
- Time remaining for first response
- Time remaining for resolution
- Breach indicators

---

## Admin Guide

### Categories Setup

Categories help organize tickets by topic.

1. Navigate to **Admin → Ticket Categories**
2. Click **Add Category**
3. Configure:
   - Name
   - Description
   - Color (for visual identification)
   - Parent category (for hierarchical structure)

```javascript
// API Example
POST /api/tickets/categories
{
  "name": "Billing",
  "description": "Payment and subscription issues",
  "color": "#3B82F6"
}
```

### SLA Policies

Configure response and resolution targets.

#### Creating SLA Policy
1. Go to **Admin → SLA Policies**
2. Click **New Policy**
3. Configure:
   - Policy name
   - Default first response time
   - Default resolution time
   - Priority overrides

```javascript
// API Example
POST /api/tickets/sla-policies
{
  "name": "Enterprise SLA",
  "first_response_hours": 4,
  "resolution_hours": 24,
  "priority_overrides": {
    "urgent": { "first_response_hours": 1, "resolution_hours": 4 },
    "high": { "first_response_hours": 2, "resolution_hours": 8 }
  },
  "business_hours_only": true,
  "is_default": false
}
```

#### Business Hours
Configure working hours for SLA calculations:
- Define work days (Mon-Fri)
- Set work hours (9:00-18:00)
- Add holidays to exclude

### Automation Rules

Automate common ticket operations.

#### Auto-Assignment
Automatically assign tickets based on:
- Category
- Priority
- Keywords in subject
- Customer attributes

**Least-Busy Algorithm:**
Tickets are assigned to the agent with fewest open tickets.

#### Escalation Rules
Configure automatic escalation when:
- SLA is about to breach
- No response within X hours
- Customer replies multiple times

### Business Hours

Configure when SLA clocks run:

1. Go to **Admin → Business Hours**
2. Set schedule per day
3. Add holiday exceptions

```javascript
// Example configuration
{
  "timezone": "America/New_York",
  "schedule": {
    "monday": { "start": "09:00", "end": "18:00" },
    "tuesday": { "start": "09:00", "end": "18:00" },
    "wednesday": { "start": "09:00", "end": "18:00" },
    "thursday": { "start": "09:00", "end": "18:00" },
    "friday": { "start": "09:00", "end": "17:00" }
  },
  "holidays": ["2024-12-25", "2024-01-01"]
}
```

---

## API Reference

### Authentication
All authenticated endpoints require Bearer token:
```
Authorization: Bearer <your-jwt-token>
```

### Endpoints

#### Tickets

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tickets` | List tickets |
| POST | `/api/tickets` | Create ticket |
| GET | `/api/tickets/:id` | Get ticket |
| PUT | `/api/tickets/:id` | Update ticket |
| DELETE | `/api/tickets/:id` | Delete ticket |
| POST | `/api/tickets/:id/resolve` | Resolve ticket |
| POST | `/api/tickets/:id/close` | Close ticket |
| POST | `/api/tickets/:id/reopen` | Reopen ticket |
| POST | `/api/tickets/:id/assign` | Assign ticket |
| POST | `/api/tickets/:id/unassign` | Unassign ticket |
| POST | `/api/tickets/:id/merge` | Merge tickets |

#### Comments

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tickets/:id/comments` | Get comments |
| POST | `/api/tickets/:id/comments` | Add comment |
| PUT | `/api/tickets/:id/comments/:commentId` | Update comment |
| DELETE | `/api/tickets/:id/comments/:commentId` | Delete comment |

#### Categories

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tickets/categories` | List categories |
| POST | `/api/tickets/categories` | Create category |
| PUT | `/api/tickets/categories/:id` | Update category |
| DELETE | `/api/tickets/categories/:id` | Delete category |

#### SLA Policies

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tickets/sla-policies` | List policies |
| POST | `/api/tickets/sla-policies` | Create policy |
| PUT | `/api/tickets/sla-policies/:id` | Update policy |
| DELETE | `/api/tickets/sla-policies/:id` | Delete policy |

#### Canned Responses

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tickets/canned-responses` | List responses |
| POST | `/api/tickets/canned-responses` | Create response |
| PUT | `/api/tickets/canned-responses/:id` | Update response |
| DELETE | `/api/tickets/canned-responses/:id` | Delete response |
| POST | `/api/tickets/canned-responses/:id/use` | Increment usage |

#### Analytics

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tickets/analytics/overview` | Overview stats |
| GET | `/api/tickets/analytics/volume` | Ticket volume |
| GET | `/api/tickets/analytics/distribution` | Distribution |
| GET | `/api/tickets/analytics/agents` | Agent performance |
| GET | `/api/tickets/analytics/sla/detailed` | SLA metrics |
| GET | `/api/tickets/analytics/csat` | CSAT scores |
| GET | `/api/tickets/analytics/peak-hours` | Peak hours |
| GET | `/api/tickets/analytics/export` | Export data |

### Request/Response Examples

#### List Tickets
```javascript
GET /api/tickets?status=open,pending&priority=high&page=1&limit=20

Response:
{
  "tickets": [
    {
      "id": "uuid",
      "ticket_number": "#1001",
      "subject": "Cannot login",
      "status": "open",
      "priority": "high",
      "requester_email": "customer@example.com",
      "requester_name": "John Doe",
      "assignee_id": null,
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

#### Create Ticket
```javascript
POST /api/tickets
{
  "subject": "Payment failed",
  "description": "My payment was declined",
  "requester_email": "customer@example.com",
  "requester_name": "Jane Smith",
  "priority": "high"
}

Response (201):
{
  "id": "uuid",
  "ticket_number": "#1002",
  "subject": "Payment failed",
  "status": "open",
  "priority": "high",
  "created_at": "2024-01-15T11:00:00Z"
}
```

#### Add Comment
```javascript
POST /api/tickets/:id/comments
{
  "body": "I'll look into this for you.",
  "is_internal": false
}

Response (201):
{
  "id": "uuid",
  "ticket_id": "ticket-uuid",
  "body": "I'll look into this for you.",
  "author_type": "agent",
  "author_name": "Support Agent",
  "is_internal": false,
  "created_at": "2024-01-15T11:05:00Z"
}
```

---

## Integration

### Chatbot Integration

Connect tickets with chatbot conversations.

#### Create Ticket from Chat
```javascript
POST /api/public/tickets/from-chat
{
  "workspace_id": "uuid",
  "conversation_id": "conv-uuid",
  "subject": "Escalated from chat",
  "description": "Customer needs human support",
  "customer_email": "customer@example.com",
  "customer_name": "John Doe",
  "chat_history": [
    { "role": "user", "content": "I need help" },
    { "role": "bot", "content": "How can I assist?" }
  ]
}

Response:
{
  "ticket": { ... },
  "accessToken": "secure-access-token"
}
```

#### Escalate Conversation
```javascript
POST /api/public/tickets/escalate
{
  "workspace_id": "uuid",
  "bot_id": "bot-uuid",
  "conversation_id": "conv-uuid",
  "reason": "complex_issue",
  "context": { ... }
}
```

### Email Integration

#### Inbound Email
Configure email parsing to create tickets:
1. Set up email forwarding to your helpdesk email
2. Configure parsing rules
3. Map email fields to ticket fields

#### Outbound Email
Ticket comments are sent as emails to customers when:
- `is_internal` is `false`
- Customer has valid email

### Webhook Events

Subscribe to ticket events:

```javascript
POST /api/webhooks
{
  "url": "https://your-app.com/webhooks",
  "events": [
    "ticket.created",
    "ticket.updated",
    "ticket.resolved",
    "ticket.closed",
    "ticket.comment.added",
    "ticket.assigned",
    "ticket.sla.breached"
  ]
}
```

#### Event Payloads

**ticket.created**
```json
{
  "event": "ticket.created",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "ticket_id": "uuid",
    "ticket_number": "#1001",
    "subject": "Need help",
    "priority": "medium"
  }
}
```

**ticket.sla.breached**
```json
{
  "event": "ticket.sla.breached",
  "timestamp": "2024-01-15T14:30:00Z",
  "data": {
    "ticket_id": "uuid",
    "ticket_number": "#1001",
    "breach_type": "first_response",
    "sla_policy_id": "policy-uuid"
  }
}
```

---

## Customer Portal

### Public Endpoints

These endpoints don't require authentication:

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/public/tickets` | Submit ticket |
| GET | `/api/public/tickets/lookup` | Find tickets by email |
| GET | `/api/public/tickets/:id` | View ticket (with token) |
| POST | `/api/public/tickets/:id/reply` | Add customer reply |
| POST | `/api/public/tickets/:id/satisfaction` | Submit rating |

### Submit Ticket
```javascript
POST /api/public/tickets
{
  "workspace_id": "uuid",
  "subject": "Question about billing",
  "description": "I have a question...",
  "requester_email": "customer@example.com",
  "requester_name": "John Doe"
}

Response:
{
  "ticket": { ... },
  "accessToken": "abc123..."
}
```

### Access Token
Customers receive an access token to view their ticket without logging in:
```
/portal/tickets/uuid?token=access-token
```

### Satisfaction Rating
After ticket resolution, customers can rate:
```javascript
POST /api/public/tickets/:id/satisfaction
{
  "access_token": "abc123...",
  "rating": 5,
  "feedback": "Great support!"
}
```

---

## Database Schema

### Tables

| Table | Description |
|-------|-------------|
| tickets | Main ticket records |
| ticket_comments | Ticket conversations |
| ticket_categories | Ticket categorization |
| sla_policies | SLA configuration |
| ticket_activities | Audit log |
| ticket_assignments | Assignment history |
| canned_responses | Saved replies |
| ticket_satisfaction | CSAT ratings |
| ticket_sequences | Ticket number generation |

### Key Fields

**tickets**
- `id` (UUID) - Primary key
- `workspace_id` (UUID) - Workspace reference
- `ticket_number` (VARCHAR) - Human-readable number
- `subject` (VARCHAR) - Ticket subject
- `description` (TEXT) - Full description
- `status` (VARCHAR) - open/pending/resolved/closed
- `priority` (VARCHAR) - urgent/high/medium/low
- `requester_email` (VARCHAR) - Customer email
- `assignee_id` (UUID) - Assigned agent
- `first_response_at` (TIMESTAMP) - First agent response
- `resolved_at` (TIMESTAMP) - Resolution time
- `closed_at` (TIMESTAMP) - Closure time

---

## Best Practices

### For Agents
1. **Respond promptly** - Watch SLA timers
2. **Use canned responses** - Save time on common queries
3. **Add internal notes** - Document important information
4. **Merge duplicates** - Keep queue clean
5. **Update status** - Keep customers informed

### For Admins
1. **Set realistic SLAs** - Based on team capacity
2. **Create useful categories** - Help with routing
3. **Build canned response library** - Improve consistency
4. **Monitor analytics** - Identify bottlenecks
5. **Configure auto-assignment** - Distribute workload evenly

### For Integration
1. **Use webhooks** - Real-time updates
2. **Handle rate limits** - Implement backoff
3. **Validate tokens** - Secure access
4. **Log everything** - Debug issues
5. **Test thoroughly** - Use test workspace
