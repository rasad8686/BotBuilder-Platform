# 🤖 AI Integration Setup Instructions

Complete guide to setting up AI capabilities for your BotBuilder platform.

---

## 📋 Prerequisites

Before setting up AI integration, ensure you have:

- ✅ BotBuilder platform already running
- ✅ PostgreSQL database configured
- ✅ Node.js 18+ installed
- ✅ Access to OpenAI and/or Anthropic API keys (optional)

---

## 🚀 Quick Start (5 Steps)

### Step 1: Install Dependencies

```bash
# Navigate to server directory
cd C:\Users\User\Desktop\BotBuilder\BotBuilder

# Install new AI dependencies
npm install openai@^4.75.0 @anthropic-ai/sdk@^0.27.0

# Verify installation
npm list openai @anthropic-ai/sdk
```

Expected output:
```
botbuilder@1.0.0
├── @anthropic-ai/sdk@0.27.0
└── openai@4.75.0
```

---

### Step 2: Run Database Migration

```bash
# From server directory
cd C:\Users\User\Desktop\BotBuilder\BotBuilder

# Run the AI tables migration
node ../server/scripts/runMigration.js 20250102_add_ai_tables.sql
```

Expected output:
```
📦 Connecting to database...
✅ Connected!
📦 Reading migration file: 20250102_add_ai_tables.sql
🔄 Executing migration...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Migration executed successfully!
   File: 20250102_add_ai_tables.sql
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

### Step 3: Verify Migration

```bash
# From server directory
node ../server/scripts/verifyAiTables.js
```

Expected output:
```
🔍 Verifying AI tables...

1️⃣  Checking ai_configurations table...
   ✅ ai_configurations table exists
   └─ Columns: 13
      - id (integer)
      - bot_id (integer)
      - provider (character varying)
      ...

2️⃣  Checking ai_usage_logs table...
   ✅ ai_usage_logs table exists
   ...

3️⃣  Checking ai_conversations table...
   ✅ ai_conversations table exists
   ...

✅ Verification complete!
```

---

### Step 4: Configure Environment Variables

```bash
# Edit .env file (or create from .env.example)
cd C:\Users\User\Desktop\BotBuilder
cp .env.example .env

# Then edit .env file
notepad .env
```

**Add these variables:**

```env
# ========================================
# AI INTEGRATION (OpenAI & Claude)
# ========================================
# Platform API Keys (Optional - for shared platform-wide AI access)
OPENAI_API_KEY=sk-your-openai-api-key-here
ANTHROPIC_API_KEY=sk-ant-your-anthropic-api-key-here

# AI Encryption Secret
AI_ENCRYPTION_SECRET=your-secure-random-string-here
```

**Getting API Keys:**

1. **OpenAI**: https://platform.openai.com/api-keys
   - Sign up / Login
   - Create new secret key
   - Copy key (starts with `sk-`)

2. **Anthropic (Claude)**: https://console.anthropic.com/settings/keys
   - Sign up / Login
   - Create API key
   - Copy key (starts with `sk-ant-`)

**Note:** Platform keys are **optional**. Users can provide their own API keys (BYO key model) when configuring AI for their bots.

---

### Step 5: Restart Server

```bash
# Stop the server (Ctrl+C if running)

# Restart
cd C:\Users\User\Desktop\BotBuilder\BotBuilder
node server.js

# Or if using nodemon
npm start
```

**Expected output:**
```
🚀 ═══════════════════════════════════════
🚀 BotBuilder Backend is LIVE!
🚀 Port: 5000
🚀 Environment: development
🚀 Time: ...
🚀 ═══════════════════════════════════════
```

---

## ✅ Verify Setup Works

### Test 1: Check API Routes

```bash
# Test providers endpoint (no auth required)
curl http://localhost:5000/api/ai/providers
```

Expected response:
```json
{
  "success": true,
  "providers": [
    {
      "id": "openai",
      "name": "Openai",
      "models": [...]
    },
    {
      "id": "claude",
      "name": "Claude",
      "models": [...]
    }
  ]
}
```

### Test 2: Use the UI

1. **Login** to your account
2. **Go to My Bots** (`/mybots`)
3. **Click "AI Config"** on any bot card
4. **Configure AI:**
   - Select provider (OpenAI or Claude)
   - Select model (e.g., GPT-4o Mini)
   - Enter API key (or leave empty for platform key)
   - Customize system prompt
   - Save configuration
5. **Test Connection** - Click "Test Connection" button
6. **Send Test Message** - Use the chat tester

---

## 📚 Advanced Configuration

### Option 1: Platform Keys (Shared)

**Pros:**
- Users don't need their own API keys
- Easier onboarding
- Centralized billing

**Cons:**
- You pay for all AI usage
- Need to monitor and limit usage

**Setup:**
```env
OPENAI_API_KEY=sk-your-platform-openai-key
ANTHROPIC_API_KEY=sk-ant-your-platform-anthropic-key
```

---

### Option 2: BYO Keys (Bring Your Own)

**Pros:**
- Users pay for their own usage
- No platform AI costs
- Unlimited scaling

**Cons:**
- Higher barrier to entry
- Users need API accounts

**Setup:**
- Leave platform keys empty in `.env`
- Users enter their own keys in AI Config page
- Keys are encrypted in database

---

### Option 3: Hybrid (Recommended)

**Best of both worlds:**
- Provide platform keys as fallback
- Allow users to optionally use their own keys

**Setup:**
```env
# Set platform keys
OPENAI_API_KEY=sk-your-platform-key

# Users can override by providing their own
```

---

## 🔐 Security Notes

### API Key Encryption

All user-provided API keys are encrypted in the database using AES-256-GCM:

```javascript
// Encryption happens automatically
const encrypted = EncryptionHelper.encrypt(apiKey);

// Decryption happens when needed
const decrypted = EncryptionHelper.decrypt(encrypted);
```

**Encryption key:** Uses `AI_ENCRYPTION_SECRET` or falls back to `JWT_SECRET`

### Best Practices

1. ✅ **Never log decrypted API keys**
2. ✅ **Use HTTPS in production**
3. ✅ **Rotate encryption keys periodically**
4. ✅ **Monitor API usage for abuse**
5. ✅ **Set rate limits on AI endpoints**

---

## 💰 Cost Management

### Understanding Costs

AI usage is billed based on **tokens** (words/characters):

**OpenAI Pricing (Jan 2025):**
- GPT-4o: $2.50 input / $10.00 output per 1M tokens
- GPT-4o Mini: $0.15 input / $0.60 output per 1M tokens ⚡ **Recommended**

**Anthropic Pricing (Jan 2025):**
- Claude 3.5 Sonnet: $3.00 input / $15.00 output per 1M tokens ⚡ **Recommended**
- Claude 3.5 Haiku: $0.80 input / $4.00 output per 1M tokens

**Typical conversation costs:**
- Short chat (100 tokens in, 50 tokens out): ~$0.0001-$0.001
- Long chat (1000 tokens in, 500 tokens out): ~$0.001-$0.01

### Cost Reduction Tips

1. **Use cheaper models** - GPT-4o Mini / Claude Haiku for most tasks
2. **Reduce context window** - Lower = fewer input tokens
3. **Set max_tokens limits** - Prevent runaway generations
4. **Monitor usage** - Check `/api/bots/:id/ai/usage` endpoint
5. **Set budget alerts** - OpenAI/Anthropic dashboards

---

## 🐛 Troubleshooting

### Problem: Migration fails

**Solution:**
```bash
# Check database connection
psql $DATABASE_URL

# Check if tables already exist
\dt ai_*

# If exists, rollback first
node ../server/scripts/runMigration.js 20250102_rollback_ai_tables.sql

# Then re-run
node ../server/scripts/runMigration.js 20250102_add_ai_tables.sql
```

---

### Problem: "API key is required" error

**Solution:**
1. Check if platform key is set in `.env`
2. OR provide your own key in AI Config page
3. Verify key format:
   - OpenAI: starts with `sk-`
   - Anthropic: starts with `sk-ant-`

---

### Problem: "Connection test failed"

**Solution:**
1. Verify API key is valid
2. Check internet connectivity
3. Ensure API provider is not having outages
4. Check API usage limits (quota)

---

### Problem: High costs

**Solution:**
1. Review usage stats: `/api/bots/:id/ai/usage`
2. Switch to cheaper models
3. Reduce context_window
4. Lower max_tokens
5. Implement rate limiting

---

## 📊 Monitoring Usage

### Via UI

1. Go to AI Config page
2. Click on "Test" tab
3. Scroll down to see usage statistics

### Via API

```bash
# Get bot usage
curl -H "Authorization: Bearer YOUR_TOKEN" \
     -H "X-Organization-ID: YOUR_ORG_ID" \
     http://localhost:5000/api/bots/123/ai/usage

# Get organization billing
curl -H "Authorization: Bearer YOUR_TOKEN" \
     -H "X-Organization-ID: YOUR_ORG_ID" \
     http://localhost:5000/api/organizations/456/ai/billing
```

### Via Database

```sql
-- Total cost per organization
SELECT
  organization_id,
  COUNT(*) as total_requests,
  SUM(total_tokens) as total_tokens,
  SUM(cost_usd) as total_cost
FROM ai_usage_logs
GROUP BY organization_id;

-- Daily usage
SELECT
  DATE(created_at) as date,
  COUNT(*) as requests,
  SUM(cost_usd) as cost
FROM ai_usage_logs
WHERE organization_id = 123
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

---

## 🎯 Next Steps

Now that AI integration is set up:

1. ✅ **Create a test bot** and configure AI
2. ✅ **Try different models** and compare quality
3. ✅ **Experiment with prompts** using templates
4. ✅ **Monitor costs** in the first week
5. ✅ **Integrate AI** into your bot flows
6. ✅ **Set up webhooks** to handle AI responses
7. ✅ **Scale** based on usage patterns

---

## 📞 Support

### Resources

- **API Documentation:** `server/routes/AI_ROUTES_DOCUMENTATION.md`
- **Test Script:** `test-ai-api.js`
- **Integration Guide:** `INTEGRATION_SUMMARY.md`

### Common Issues

If you encounter issues:

1. Check server logs for errors
2. Verify environment variables are set
3. Test API endpoints with curl
4. Check database tables exist
5. Review this guide's troubleshooting section

---

## 🎉 You're All Set!

AI integration is now fully operational. Your users can:

- Configure AI for their bots
- Choose between OpenAI and Claude
- Customize AI behavior with prompts
- Test AI before deploying
- Monitor usage and costs
- Use context-aware conversations

**Happy building! 🚀**
