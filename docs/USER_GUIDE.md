# BotBuilder User Guide

Complete guide for using the BotBuilder platform to create, deploy, and manage AI-powered chatbots.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Dashboard Overview](#dashboard-overview)
3. [Creating Your First Bot](#creating-your-first-bot)
4. [AI Configuration](#ai-configuration)
5. [Flow Builder](#flow-builder)
6. [Knowledge Base (RAG)](#knowledge-base-rag)
7. [Channel Integration](#channel-integration)
8. [Autonomous Agents](#autonomous-agents)
9. [Voice Bots](#voice-bots)
10. [Analytics](#analytics)
11. [Team Management](#team-management)
12. [Billing & Plans](#billing--plans)
13. [API Tokens](#api-tokens)
14. [Settings](#settings)
15. [Troubleshooting](#troubleshooting)

---

## Getting Started

### Creating an Account

1. Navigate to the BotBuilder login page
2. Click **"Sign Up"** or **"Register"**
3. Enter your email, password, and name
4. Verify your email address
5. Complete your profile setup

### Logging In

1. Go to the login page
2. Enter your email and password
3. If 2FA is enabled, enter your verification code
4. Click **"Login"**

### First-Time Setup

After logging in for the first time:

1. **Create an Organization** - Set up your workspace
2. **Invite Team Members** - Add collaborators (optional)
3. **Configure AI Provider** - Add your OpenAI or Anthropic API key
4. **Create Your First Bot** - Start building!

---

## Dashboard Overview

The dashboard provides an overview of your bots and key metrics.

### Main Sections

| Section | Description |
|---------|-------------|
| **Bot Cards** | Quick view of all your bots |
| **Message Stats** | Total messages processed |
| **Active Users** | Current active conversations |
| **Quick Actions** | Create bot, view analytics |

### Navigation Menu

- **Dashboard** - Home overview
- **My Bots** - Bot management
- **Flow Builder** - Visual bot designer
- **Knowledge Base** - RAG documents
- **Channels** - Platform connections
- **Analytics** - Performance metrics
- **Team** - User management
- **Settings** - Account settings

---

## Creating Your First Bot

### Step 1: Basic Information

1. Click **"Create Bot"** from the dashboard
2. Enter a **Bot Name** (e.g., "Customer Support Bot")
3. Select a **Language** (60+ languages available)
4. Add a **Description** (optional)
5. Click **"Create"**

### Step 2: Configure AI

1. Go to your bot's **AI Settings**
2. Select an AI provider:
   - **OpenAI** - GPT-4, GPT-3.5-Turbo
   - **Anthropic** - Claude 3.5 Sonnet
3. Set the **System Prompt** - Define your bot's personality
4. Adjust **Temperature** (creativity level: 0.0 - 1.0)
5. Set **Max Tokens** (response length)

### Step 3: Test Your Bot

1. Open the **Test Chat** panel
2. Send a message to your bot
3. Review the response
4. Adjust settings as needed

### Example System Prompt

```
You are a helpful customer support assistant for TechStore.
Be friendly, professional, and concise.
If you don't know something, offer to connect the user with a human agent.
```

---

## AI Configuration

### Supported AI Providers

| Provider | Models | Best For |
|----------|--------|----------|
| **OpenAI** | GPT-4, GPT-4-Turbo, GPT-3.5-Turbo | General use, coding |
| **Anthropic** | Claude 3.5 Sonnet, Claude 3 Opus | Long conversations, analysis |

### Configuration Options

#### System Prompt
Defines your bot's personality and behavior rules.

**Tips:**
- Be specific about tone (formal, casual, friendly)
- Include examples of ideal responses
- Set clear boundaries (what not to discuss)
- Define fallback behavior

#### Temperature
Controls response creativity:
- **0.0 - 0.3**: Factual, consistent responses
- **0.4 - 0.7**: Balanced creativity
- **0.8 - 1.0**: More creative, varied responses

#### Max Tokens
Maximum response length (1 token ~ 4 characters):
- Short responses: 150-300 tokens
- Medium responses: 300-500 tokens
- Long responses: 500-1000 tokens

### Fine-Tuning

Create custom-trained models with your data:

1. Go to **AI Settings > Fine-Tuning**
2. Upload training data (JSONL format)
3. Configure training parameters
4. Start training job
5. Deploy trained model

---

## Flow Builder

The visual Flow Builder lets you design conversation paths.

### Node Types

| Node | Purpose | Example |
|------|---------|---------|
| **Start** | Entry point | User initiates chat |
| **Message** | Send text to user | "Hello! How can I help?" |
| **AI Response** | Generate AI reply | Dynamic response |
| **Condition** | Branch based on input | If intent = "pricing" |
| **Action** | Execute task | Send email, API call |
| **Human Handoff** | Transfer to agent | Complex issues |
| **End** | End conversation | "Goodbye!" |

### Building a Flow

1. Open **Flow Builder** for your bot
2. Drag nodes from the sidebar
3. Connect nodes by dragging lines
4. Configure each node's settings
5. Click **Save** to deploy

### Example Flow: FAQ Bot

```
[Start]
    ↓
[Message: "Hi! What can I help you with?"]
    ↓
[Condition: Check Intent]
    ├── Pricing → [Message: "Our plans start at $9/mo"]
    ├── Support → [AI Response: Generate help]
    └── Other → [Human Handoff]
```

---

## Knowledge Base (RAG)

Retrieval-Augmented Generation allows your bot to answer questions from your documents.

### Supported File Types

- **PDF** - Product manuals, guides
- **Word** (.docx) - Documentation
- **Text** (.txt) - FAQs, articles
- **Markdown** (.md) - Technical docs

### Adding Documents

1. Go to **Knowledge Base**
2. Click **"Create Knowledge Base"**
3. Name your knowledge base
4. Upload documents (drag & drop or browse)
5. Wait for processing (chunking + embedding)
6. Link to your bot

### How RAG Works

1. User asks a question
2. System searches your documents
3. Relevant chunks are retrieved
4. AI generates answer using context
5. Response includes source citations

### Best Practices

- **Organize documents** by topic
- **Update regularly** to keep info current
- **Test queries** to ensure accuracy
- **Use clear headings** in documents
- **Avoid duplicate content**

---

## Channel Integration

Deploy your bot across multiple platforms.

### Available Channels

| Channel | Setup Complexity | Features |
|---------|-----------------|----------|
| **Web Widget** | Easy | Embed on any website |
| **Telegram** | Easy | Groups, inline bots |
| **Discord** | Medium | Servers, threads |
| **WhatsApp** | Medium | Business API required |
| **Facebook** | Medium | Messenger integration |
| **Instagram** | Medium | DM automation |
| **Slack** | Medium | Workspace apps |

### Web Widget Setup

1. Go to **Channels > Web Widget**
2. Click **"Enable Widget"**
3. Customize appearance (colors, position)
4. Copy the embed code
5. Paste into your website's HTML

```html
<script src="https://your-domain.com/widget.js"
        data-bot-id="your-bot-id"></script>
```

### Telegram Setup

1. Create a bot via [@BotFather](https://t.me/BotFather)
2. Copy the bot token
3. Go to **Channels > Telegram**
4. Paste your token and save
5. Set webhook URL (automatic)

### Discord Setup

1. Create app at [Discord Developer Portal](https://discord.com/developers)
2. Create a bot and copy token
3. Go to **Channels > Discord**
4. Paste token and configure
5. Add bot to your server

### WhatsApp Setup

1. Set up Meta Business account
2. Get WhatsApp Business API access
3. Go to **Channels > WhatsApp**
4. Enter credentials and verify
5. Configure message templates

---

## Autonomous Agents

Create AI agents that can perform tasks independently.

### What Are Autonomous Agents?

Agents can:
- Browse the web
- Send emails
- Make API calls
- Process files
- Execute workflows

### Creating an Agent

1. Go to **Agents > Create Agent**
2. Define the agent's **Goal**
3. Select available **Tools**
4. Set **Constraints** (what it can't do)
5. Configure **Memory** settings
6. Deploy and test

### Available Tools

| Tool | Capability |
|------|------------|
| **Web Browser** | Search, scrape websites |
| **Email** | Send emails via SMTP |
| **HTTP** | Make API requests |
| **File** | Read, write files |
| **Database** | Query databases |
| **Code** | Execute code snippets |

### Example: Research Agent

```
Goal: Research competitors and create a summary report

Tools: Web Browser, File

Constraints:
- Only visit business websites
- Don't share sensitive data
- Maximum 10 pages per search
```

---

## Voice Bots

Create voice-enabled bots with speech recognition.

### Voice Features

- **Speech-to-Text**: Transcribe voice input
- **Text-to-Speech**: Generate voice responses
- **Phone Calls**: Twilio integration
- **Real-time**: Low-latency streaming

### Setting Up Voice

1. Go to **Voice > Create Voice Bot**
2. Configure speech provider (Google, Gladia)
3. Select voice and language
4. Link to your bot's flow
5. Set up phone number (optional)

### Voice Settings

| Setting | Options |
|---------|---------|
| **Language** | 50+ languages |
| **Voice** | Male, Female, Neural |
| **Speed** | 0.5x - 2.0x |
| **Pitch** | Low, Normal, High |

---

## Analytics

Track your bot's performance and user engagement.

### Available Metrics

| Metric | Description |
|--------|-------------|
| **Total Messages** | All messages processed |
| **Active Users** | Unique users per period |
| **Response Time** | Average AI response speed |
| **Resolution Rate** | % of resolved conversations |
| **Sentiment Score** | User satisfaction estimate |

### Viewing Analytics

1. Go to **Analytics**
2. Select date range
3. Choose bot (or all bots)
4. View charts and tables
5. Export data (CSV, PDF)

### Reports

- **Daily Summary** - Automated email reports
- **Weekly Trends** - Performance comparison
- **Monthly Review** - Detailed analysis
- **Custom Reports** - Build your own

---

## Team Management

Collaborate with your team on bot development.

### Roles & Permissions

| Role | Capabilities |
|------|-------------|
| **Owner** | Full access, billing, delete org |
| **Admin** | Manage team, all bot access |
| **Member** | Create/edit assigned bots |
| **Viewer** | Read-only access |

### Inviting Team Members

1. Go to **Team > Invite**
2. Enter email address
3. Select role
4. Click **"Send Invitation"**
5. User accepts via email link

### Organizations

- Create multiple organizations
- Switch between orgs easily
- Separate billing per org
- Custom branding per org (Enterprise)

---

## Billing & Plans

### Available Plans

| Plan | Price | Features |
|------|-------|----------|
| **Free** | $0/mo | 1 bot, 1K messages |
| **Pro** | $29/mo | 10 bots, 50K messages |
| **Business** | $99/mo | Unlimited bots, 500K messages |
| **Enterprise** | Custom | Dedicated support, SLA |

### Managing Subscription

1. Go to **Settings > Billing**
2. View current plan and usage
3. Click **"Upgrade"** to change plan
4. Enter payment information
5. Confirm subscription

### Usage Tracking

- View real-time message count
- Set usage alerts
- Download invoices
- Track AI costs (tokens used)

---

## API Tokens

Access the BotBuilder API programmatically.

### Creating an API Token

1. Go to **Settings > API Tokens**
2. Click **"Create Token"**
3. Enter a name/description
4. Set expiration (optional)
5. Copy and store securely

**Important**: Token is shown only once. Store it safely!

### Token Features

- **IP Allowlist** - Restrict by IP address
- **Spending Limits** - Set monthly caps
- **Auto-Rotation** - Schedule key rotation
- **Usage Tracking** - Monitor API calls

### Using the API

```bash
curl -X GET "https://api.botbuilder.com/api/bots" \
  -H "Authorization: Bearer YOUR_API_TOKEN"
```

See [API Reference](API_REFERENCE.md) for complete documentation.

---

## Settings

### Account Settings

- **Profile** - Name, email, avatar
- **Password** - Change password
- **2FA** - Enable two-factor authentication
- **Sessions** - Manage active sessions
- **Notifications** - Email preferences

### Organization Settings

- **General** - Name, logo, timezone
- **Billing** - Subscription, invoices
- **Team** - Member management
- **SSO** - Enterprise single sign-on
- **API** - Token management
- **Webhooks** - Event notifications

### Security Settings

1. **Enable 2FA**:
   - Go to Settings > Security
   - Click "Enable 2FA"
   - Scan QR code with authenticator app
   - Enter verification code
   - Save backup codes

2. **API Key Security**:
   - Rotate keys regularly
   - Use IP allowlists
   - Set spending limits
   - Monitor usage

---

## Troubleshooting

### Common Issues

#### Bot Not Responding

1. Check AI provider API key is valid
2. Verify bot is published/active
3. Check rate limits
4. Review error logs

#### Channel Not Connected

1. Verify credentials are correct
2. Check webhook URL is accessible
3. Ensure SSL certificate is valid
4. Review platform-specific requirements

#### Knowledge Base Not Working

1. Ensure documents are processed
2. Check if KB is linked to bot
3. Verify RAG is enabled in AI settings
4. Test with specific queries

#### Slow Response Times

1. Reduce max tokens
2. Use faster AI model
3. Optimize knowledge base size
4. Check network latency

### Getting Help

- **Documentation**: [docs/](../docs/)
- **API Docs**: `/api-docs` (Swagger UI)
- **Support Email**: support@botbuilder.com
- **Community Forum**: forum.botbuilder.com

### Error Codes

| Code | Meaning | Solution |
|------|---------|----------|
| 401 | Unauthorized | Check API key/token |
| 403 | Forbidden | Check permissions |
| 404 | Not Found | Verify resource exists |
| 429 | Rate Limited | Wait and retry |
| 500 | Server Error | Contact support |

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl + S` | Save changes |
| `Ctrl + Z` | Undo |
| `Ctrl + Y` | Redo |
| `Ctrl + /` | Toggle help |
| `Esc` | Close modal |

---

## Tips & Best Practices

### Bot Design

1. **Start simple** - Add complexity gradually
2. **Test thoroughly** - Use test chat before deploying
3. **Monitor analytics** - Track performance
4. **Iterate** - Improve based on user feedback

### AI Prompts

1. **Be specific** - Clear instructions = better responses
2. **Use examples** - Show desired output format
3. **Set boundaries** - Define what bot shouldn't do
4. **Test edge cases** - Handle unexpected inputs

### Knowledge Base

1. **Quality over quantity** - Curate your documents
2. **Structure content** - Use clear headings
3. **Update regularly** - Keep information fresh
4. **Test queries** - Verify retrieval accuracy

---

## Glossary

| Term | Definition |
|------|------------|
| **RAG** | Retrieval-Augmented Generation |
| **LLM** | Large Language Model |
| **NLU** | Natural Language Understanding |
| **Intent** | User's goal or purpose |
| **Entity** | Specific data in user input |
| **Flow** | Conversation path design |
| **Token** | Unit of text for AI processing |
| **Embedding** | Vector representation of text |
| **Webhook** | HTTP callback for events |
| **SSO** | Single Sign-On |
| **SCIM** | System for Cross-domain Identity Management |
| **RBAC** | Role-Based Access Control |

---

*Last updated: January 2026*
