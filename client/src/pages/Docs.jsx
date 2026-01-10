import { useState, useCallback } from 'react';
import DocsSidebar from '../components/docs/DocsSidebar';
import DocsContent from '../components/docs/DocsContent';
import CodePanel from '../components/docs/CodePanel';
import DocsAI from '../components/docs/DocsAI';
import DarkModeToggle from '../components/docs/DarkModeToggle';
import SearchModal from '../components/docs/SearchModal';
import useDocsShortcuts from '../hooks/useDocsShortcuts';
import { Rocket, Bot, Brain, BookOpen, Smartphone, Cpu, Plug, CreditCard, Lock } from 'lucide-react';

// Documentation content - organized by category
const docsContent = {
  'getting-started': {
    title: 'Getting Started',
    Icon: Rocket,
    sections: [
      {
        id: 'overview',
        title: 'Overview',
        content: `
# BotBuilder Platform

BotBuilder is an enterprise-grade AI chatbot builder platform with multi-channel support, autonomous agents, and advanced analytics.

## Key Features

- **Multi-Channel Support**: Deploy bots to Discord, Telegram, WhatsApp, Facebook, Instagram, Slack
- **AI Integration**: OpenAI GPT-4, Anthropic Claude, Google Gemini
- **Autonomous Agents**: Self-operating AI agents with tool execution
- **Knowledge Base (RAG)**: Document-based AI with vector embeddings
- **Voice Bots**: Twilio integration with real-time transcription
- **Fine-Tuning**: Custom model training pipeline
- **Flow Builder**: Visual drag-and-drop conversation designer
- **Plugin Marketplace**: Extensible plugin ecosystem
        `
      },
      {
        id: 'quickstart',
        title: 'Quick Start',
        content: `
## Quick Start Guide

### 1. Create an Account
1. Go to the registration page
2. Enter your email, password, and name
3. Verify your email address

### 2. Create Your First Bot
1. Click "Create Bot" on the dashboard
2. Enter a name and select language
3. Configure AI settings
4. Test your bot in the chat panel

### 3. Connect a Channel
1. Go to Channels section
2. Select a platform (Telegram, Discord, etc.)
3. Follow the setup instructions
4. Your bot is now live!
        `
      }
    ]
  },
  'bots': {
    title: 'Bot Management',
    Icon: Bot,
    sections: [
      {
        id: 'create-bot',
        title: 'Creating a Bot',
        content: `
## Creating a Bot

### Basic Information
- **Name**: Give your bot a descriptive name
- **Language**: Select from 60+ supported languages
- **Description**: Optional description for your reference

### AI Configuration
- **Provider**: Choose OpenAI or Anthropic
- **Model**: Select GPT-4, GPT-3.5, or Claude
- **System Prompt**: Define your bot's personality
- **Temperature**: Control creativity (0.0 - 1.0)
- **Max Tokens**: Set response length limit
        `
      },
      {
        id: 'flow-builder',
        title: 'Flow Builder',
        content: `
## Flow Builder

The visual Flow Builder lets you design conversation paths with drag-and-drop.

### Node Types
| Node | Purpose |
|------|---------|
| **Start** | Entry point |
| **Message** | Send text to user |
| **AI Response** | Generate AI reply |
| **Condition** | Branch based on input |
| **Action** | Execute external task |
| **Human Handoff** | Transfer to agent |
| **End** | End conversation |

### Tips
- Keep flows simple and focused
- Test each path thoroughly
- Use conditions for FAQ handling
        `
      }
    ]
  },
  'ai': {
    title: 'AI Configuration',
    Icon: Brain,
    sections: [
      {
        id: 'providers',
        title: 'AI Providers',
        content: `
## Supported AI Providers

### OpenAI
- **GPT-4**: Most capable, best for complex tasks
- **GPT-4-Turbo**: Faster, 128K context
- **GPT-3.5-Turbo**: Fast and cost-effective

### Anthropic
- **Claude 3.5 Sonnet**: Excellent for analysis
- **Claude 3 Opus**: Most capable Claude model

### Configuration
\`\`\`
Temperature: 0.7 (balanced creativity)
Max Tokens: 500 (medium responses)
Top P: 1.0 (standard sampling)
\`\`\`
        `
      },
      {
        id: 'fine-tuning',
        title: 'Fine-Tuning',
        content: `
## Model Fine-Tuning

Train custom models with your data.

### Steps
1. Prepare training data (JSONL format)
2. Upload dataset
3. Configure training parameters
4. Start training job
5. Deploy trained model

### Data Format
\`\`\`json
{"messages": [
  {"role": "system", "content": "..."},
  {"role": "user", "content": "..."},
  {"role": "assistant", "content": "..."}
]}
\`\`\`
        `
      }
    ]
  },
  'knowledge': {
    title: 'Knowledge Base',
    Icon: BookOpen,
    sections: [
      {
        id: 'rag',
        title: 'RAG System',
        content: `
## Knowledge Base (RAG)

Retrieval-Augmented Generation allows your bot to answer from your documents.

### How It Works
1. Upload documents (PDF, DOCX, TXT, MD)
2. System chunks and creates embeddings
3. User asks a question
4. Relevant chunks are retrieved
5. AI generates answer with context

### Supported Files
- PDF documents
- Word files (.docx)
- Text files (.txt)
- Markdown (.md)
        `
      },
      {
        id: 'best-practices',
        title: 'Best Practices',
        content: `
## Knowledge Base Best Practices

### Document Preparation
- Use clear headings and structure
- Keep paragraphs focused
- Avoid duplicate content
- Update regularly

### Chunking
- Default: 500 tokens per chunk
- Overlap: 50 tokens
- Adjust based on content type

### Testing
- Test various query types
- Check source citations
- Monitor retrieval accuracy
        `
      }
    ]
  },
  'channels': {
    title: 'Channel Integration',
    Icon: Smartphone,
    sections: [
      {
        id: 'telegram',
        title: 'Telegram',
        content: `
## Telegram Integration

### Setup Steps
1. Message @BotFather on Telegram
2. Create new bot with /newbot
3. Copy the bot token
4. Paste in BotBuilder Channels > Telegram
5. Webhook is set automatically

### Features
- Text messages
- Media (images, files)
- Inline keyboards
- Group support
        `
      },
      {
        id: 'discord',
        title: 'Discord',
        content: `
## Discord Integration

### Setup Steps
1. Go to Discord Developer Portal
2. Create new application
3. Create bot and copy token
4. Enable required intents
5. Add bot to your server
6. Configure in BotBuilder

### Features
- Slash commands
- Embeds
- Thread support
- Role management
        `
      },
      {
        id: 'whatsapp',
        title: 'WhatsApp',
        content: `
## WhatsApp Integration

### Requirements
- Meta Business Account
- WhatsApp Business API access
- Verified phone number

### Setup Steps
1. Set up Meta Business account
2. Create WhatsApp Business app
3. Get API credentials
4. Configure in BotBuilder
5. Set up message templates

### Features
- Text & media messages
- Template messages
- Interactive buttons
- Quick replies
        `
      }
    ]
  },
  'agents': {
    title: 'Autonomous Agents',
    Icon: Cpu,
    sections: [
      {
        id: 'overview',
        title: 'Agent Overview',
        content: `
## Autonomous Agents

AI agents that can perform tasks independently.

### Capabilities
- Browse the web
- Send emails
- Make API calls
- Process files
- Execute workflows

### Components
- **Goal**: What the agent should achieve
- **Tools**: Available capabilities
- **Constraints**: Limitations
- **Memory**: Context retention
        `
      },
      {
        id: 'tools',
        title: 'Available Tools',
        content: `
## Agent Tools

| Tool | Capability |
|------|------------|
| **Web Browser** | Search & scrape |
| **Email** | Send via SMTP |
| **HTTP** | API requests |
| **File** | Read/write files |
| **Database** | Query databases |
| **Code** | Execute code |

### Custom Tools
Create custom tools by:
1. Going to Tool Studio
2. Defining tool schema
3. Implementing handler
4. Testing execution
        `
      }
    ]
  },
  'api': {
    title: 'API Reference',
    Icon: Plug,
    sections: [
      {
        id: 'authentication',
        title: 'Authentication',
        content: `
## API Authentication

### Bearer Token
\`\`\`http
Authorization: Bearer <jwt_token>
\`\`\`

### API Key
\`\`\`http
X-API-Key: <api_key>
\`\`\`

### Getting Tokens
1. Login via /api/auth/login
2. Use returned JWT token
3. Or create API token in settings
        `
      },
      {
        id: 'endpoints',
        title: 'Core Endpoints',
        content: `
## Core API Endpoints

### Bots
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/bots | List bots |
| POST | /api/bots | Create bot |
| GET | /api/bots/:id | Get bot |
| PUT | /api/bots/:id | Update bot |
| DELETE | /api/bots/:id | Delete bot |

### Messages
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/bots/:id/ai/chat | Send message |
| GET | /api/bots/:id/messages | Get history |

### Full API documentation available at /api-docs
        `
      },
      {
        id: 'rate-limits',
        title: 'Rate Limits',
        content: `
## Rate Limiting

### Limits by Plan
| Plan | Requests/Min | Requests/Day |
|------|-------------|--------------|
| Free | 20 | 1,000 |
| Pro | 100 | 10,000 |
| Enterprise | 500 | 100,000 |

### Response Headers
- \`X-RateLimit-Limit\`: Max requests
- \`X-RateLimit-Remaining\`: Remaining
- \`X-RateLimit-Reset\`: Reset time
        `
      }
    ]
  },
  'billing': {
    title: 'Billing & Plans',
    Icon: CreditCard,
    sections: [
      {
        id: 'plans',
        title: 'Pricing Plans',
        content: `
## Pricing Plans

### Free
- 1 bot
- 1,000 messages/month
- Basic analytics
- Community support

### Pro ($29/month)
- 10 bots
- 50,000 messages/month
- Advanced analytics
- Email support
- Custom branding

### Business ($99/month)
- Unlimited bots
- 500,000 messages/month
- Priority support
- SSO integration
- API access

### Enterprise (Custom)
- Dedicated infrastructure
- SLA guarantees
- Custom contracts
- Dedicated support
        `
      }
    ]
  },
  'security': {
    title: 'Security',
    Icon: Lock,
    sections: [
      {
        id: 'authentication',
        title: 'Authentication',
        content: `
## Security Features

### Authentication
- JWT tokens with refresh rotation
- httpOnly cookies
- 2FA/TOTP support
- API key management

### Data Protection
- AES-256 encryption
- bcrypt password hashing
- CSRF protection
- XSS prevention

### Compliance
- GDPR ready
- Audit logging
- Data export
- Right to deletion
        `
      }
    ]
  }
};

// Sidebar categories
const categories = Object.keys(docsContent).map(key => ({
  id: key,
  ...docsContent[key]
}));

export default function Docs() {
  const [activeCategory, setActiveCategory] = useState('getting-started');
  const [activeSection, setActiveSection] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Search modal navigation handler
  const handleSearchNavigate = useCallback((categoryId, sectionId) => {
    setActiveCategory(categoryId);
    setActiveSection(sectionId);
  }, []);

  const currentCategory = docsContent[activeCategory];
  const currentSection = currentCategory?.sections.find(s => s.id === activeSection) || currentCategory?.sections[0];

  // Get all sections for navigation
  const allSections = categories.flatMap(cat =>
    cat.sections.map(sec => ({ ...sec, categoryId: cat.id, categoryTitle: cat.title }))
  );

  const currentIndex = allSections.findIndex(
    s => s.categoryId === activeCategory && s.id === activeSection
  );

  const previousSection = currentIndex > 0 ? allSections[currentIndex - 1] : null;
  const nextSection = currentIndex < allSections.length - 1 ? allSections[currentIndex + 1] : null;

  const handlePrevious = useCallback(() => {
    if (previousSection) {
      setActiveCategory(previousSection.categoryId);
      setActiveSection(previousSection.id);
    }
  }, [previousSection]);

  const handleNext = useCallback(() => {
    if (nextSection) {
      setActiveCategory(nextSection.categoryId);
      setActiveSection(nextSection.id);
    }
  }, [nextSection]);

  // Keyboard shortcuts - placed after handlePrevious and handleNext are defined
  useDocsShortcuts({
    onSearch: () => setIsSearchOpen(true),
    onPrevious: handlePrevious,
    onNext: handleNext,
    onToggleSidebar: () => setIsMobileSidebarOpen(prev => !prev),
    onScrollToTop: () => window.scrollTo({ top: 0, behavior: 'smooth' }),
    onCopyLink: () => {
      const url = `${window.location.origin}/docs/${activeCategory}/${activeSection}`;
      navigator.clipboard.writeText(url);
    }
  });

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: '#fff' }}>
      {/* Search Modal */}
      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        categories={categories}
        onNavigate={handleSearchNavigate}
      />

      {/* Top Bar with Dark Mode Toggle and Search */}
      <div className="fixed top-4 right-4 xl:right-[416px] z-30 flex items-center gap-2">
        {/* Search Button */}
        <button
          onClick={() => setIsSearchOpen(true)}
          className="hidden lg:flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all hover:border-purple-300"
          style={{
            backgroundColor: '#fff',
            borderColor: '#e6ebf1',
            color: '#8898aa'
          }}
          aria-label="Search documentation (Ctrl+K)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span>Search</span>
          <kbd className="ml-2 px-1.5 py-0.5 text-xs rounded" style={{ backgroundColor: '#f6f9fc' }}>
            Ctrl+K
          </kbd>
        </button>

        {/* Dark Mode Toggle */}
        <DarkModeToggle />
      </div>

      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsMobileSidebarOpen(true)}
        className="fixed top-4 left-4 z-30 lg:hidden p-2 rounded-lg shadow-lg"
        style={{ backgroundColor: '#635bff', color: '#fff' }}
        aria-label="Open navigation menu"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Left Sidebar - Navigation (250px, sticky) */}
      <DocsSidebar
        categories={categories}
        activeCategory={activeCategory}
        activeSection={activeSection}
        onCategoryChange={setActiveCategory}
        onSectionChange={setActiveSection}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        isMobileOpen={isMobileSidebarOpen}
        onMobileClose={() => setIsMobileSidebarOpen(false)}
      />

      {/* Center Content (flex-grow, max-width 800px) */}
      <DocsContent
        category={currentCategory}
        section={currentSection}
        sections={currentCategory?.sections}
        onSectionChange={setActiveSection}
        onPrevious={handlePrevious}
        onNext={handleNext}
        previousSection={previousSection}
        nextSection={nextSection}
      />

      {/* Right Panel - Code Examples (400px, dark theme) */}
      <aside
        className="hidden xl:block w-[400px] flex-shrink-0 sticky top-0 h-screen border-l"
        style={{ borderColor: '#e6ebf1' }}
      >
        <CodePanel
          category={activeCategory}
          section={activeSection}
        />
      </aside>

      {/* Responsive: Code panel below content on tablet */}
      <div
        className="hidden md:block xl:hidden fixed bottom-0 left-[250px] right-0 h-[300px] border-t z-20"
        style={{ borderColor: '#e6ebf1' }}
      >
        <CodePanel
          category={activeCategory}
          section={activeSection}
        />
      </div>

      {/* Mobile: Code toggle button */}
      <MobileCodePanel
        category={activeCategory}
        section={activeSection}
      />

      {/* AI Documentation Assistant */}
      <DocsAI />
    </div>
  );
}

// Mobile Code Panel Component
function MobileCodePanel({ category, section }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Toggle Button - positioned to avoid overlap with DocsAI button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-24 z-30 md:hidden p-3 rounded-full shadow-lg"
        style={{ backgroundColor: '#1e1e1e', color: '#fff' }}
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
        </svg>
      </button>

      {/* Mobile Code Panel */}
      {isOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black bg-opacity-50"
            onClick={() => setIsOpen(false)}
          />
          <div
            className="absolute bottom-0 left-0 right-0 h-[70vh] rounded-t-2xl overflow-hidden"
            style={{ backgroundColor: '#1e1e1e' }}
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <span className="text-white font-medium">Code Examples</span>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="h-[calc(70vh-60px)]">
              <CodePanel category={category} section={section} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
