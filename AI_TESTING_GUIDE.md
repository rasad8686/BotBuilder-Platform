# 🧪 AI Integration Testing Guide

Comprehensive testing guide for AI features.

---

## 📋 Testing Checklist

### ✅ Phase 1: Setup Verification

- [ ] Database migration ran successfully
- [ ] AI tables exist in database
- [ ] Dependencies installed (openai, @anthropic-ai/sdk)
- [ ] Environment variables configured
- [ ] Server starts without errors

### ✅ Phase 2: API Endpoint Tests

- [ ] GET /api/ai/providers returns providers
- [ ] GET /api/ai/models/:provider returns models
- [ ] POST /api/bots/:id/ai/configure creates config
- [ ] GET /api/bots/:id/ai/configure retrieves config
- [ ] POST /api/bots/:id/ai/test tests connection
- [ ] POST /api/bots/:id/ai/chat sends messages
- [ ] GET /api/bots/:id/ai/usage returns statistics

### ✅ Phase 3: Frontend UI Tests

- [ ] AI Config button visible on bot cards
- [ ] AI Config page loads correctly
- [ ] Provider selection works
- [ ] Model selection works
- [ ] Prompt templates load
- [ ] Parameter sliders work
- [ ] Save configuration works
- [ ] Chat tester works
- [ ] Usage stats display

### ✅ Phase 4: Integration Tests

- [ ] Context window maintains conversation
- [ ] Cost calculation is accurate
- [ ] Usage logging works
- [ ] Encryption/decryption works
- [ ] RBAC permissions enforced
- [ ] Organization isolation works

---

## 🚀 Quick Test Scripts

### Test 1: Automated API Tests

Run the comprehensive test script:

```bash
# Update credentials in test-ai-api.js first
cd C:\Users\User\Desktop\BotBuilder
node test-ai-api.js
```

**Expected output:**
```
═══════════════════════════════════════════════
🧪 AI API TEST SUITE
═══════════════════════════════════════════════

📋 TEST 1: Get Available Providers
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ SUCCESS
Found 2 providers:
  - Openai: 3 models
  - Claude: 3 models

📋 TEST 2: Get Models for OpenAI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ SUCCESS
Found 3 OpenAI models:
  - GPT-4o (gpt-4o)
    Pricing: $2.5/$10 per 1M tokens
  - GPT-4o Mini (gpt-4o-mini)
    Pricing: $0.15/$0.6 per 1M tokens
  - GPT-4 Turbo (gpt-4-turbo)
    Pricing: $10/$30 per 1M tokens

... (more tests)

═══════════════════════════════════════════════
📊 TEST SUMMARY
═══════════════════════════════════════════════
✅ Passed: 9/9
❌ Failed: 0/9

🎉 All tests passed!
```

---

### Test 2: Manual UI Testing

**Step-by-step UI test:**

1. **Login to Application**
   - URL: `http://localhost:5173`
   - Login with test account

2. **Navigate to My Bots**
   - Click "My Bots" in sidebar
   - Verify bots are listed

3. **Click AI Config**
   - Click "🤖 AI Config" button on any bot
   - Should navigate to `/bots/:id/ai`

4. **Setup Tab Testing**
   - ✅ Select OpenAI provider
   - ✅ Select GPT-4o Mini model
   - ✅ Enter API key (or leave empty)
   - ✅ Toggle "Enable AI" switch
   - ✅ Verify UI updates

5. **Prompt Tab Testing**
   - ✅ Click "Prompt" tab
   - ✅ Click "Show Prompt Templates"
   - ✅ Select "Customer Support" template
   - ✅ Verify prompt is populated
   - ✅ Edit prompt text
   - ✅ Verify character/word count updates

6. **Parameters Tab Testing**
   - ✅ Click "Parameters" tab
   - ✅ Adjust temperature slider (0-2)
   - ✅ Adjust max tokens slider (100-4000)
   - ✅ Adjust context window (0-50)
   - ✅ Toggle streaming
   - ✅ Verify all values update

7. **Save Configuration**
   - ✅ Click "Save Configuration" button
   - ✅ Verify success message appears
   - ✅ Verify green checkmark

8. **Test Tab Testing**
   - ✅ Click "Test" tab
   - ✅ Click "Test Connection" button
   - ✅ Verify ✅ success message
   - ✅ Type message: "Hello!"
   - ✅ Click "Send" button
   - ✅ Verify AI responds
   - ✅ Check token usage displayed
   - ✅ Check cost displayed
   - ✅ Check response time displayed

9. **Context Testing**
   - ✅ Send message: "What did I just say?"
   - ✅ Verify AI remembers ("Hello!")
   - ✅ Send multiple messages
   - ✅ Verify conversation flows naturally

10. **Error Handling**
    - ✅ Enter invalid API key
    - ✅ Click "Test Connection"
    - ✅ Verify error message displays
    - ✅ Fix API key
    - ✅ Test again - should work

---

### Test 3: Database Verification

```sql
-- Check AI configurations exist
SELECT * FROM ai_configurations;

-- Check usage logs are being created
SELECT * FROM ai_usage_logs
ORDER BY created_at DESC
LIMIT 10;

-- Check conversation history
SELECT * FROM ai_conversations
ORDER BY created_at DESC
LIMIT 20;

-- Verify cost calculations
SELECT
  provider,
  model,
  SUM(total_tokens) as total_tokens,
  SUM(cost_usd) as total_cost,
  COUNT(*) as request_count
FROM ai_usage_logs
GROUP BY provider, model;
```

---

### Test 4: Cost Calculation Test

```javascript
// Run this in Node.js console or create a test file

const { AICostCalculator } = require('./server/services/ai');

// Test OpenAI GPT-4o Mini cost
const cost1 = AICostCalculator.calculateCost({
  provider: 'openai',
  model: 'gpt-4o-mini',
  promptTokens: 100,
  completionTokens: 50
});

console.log('GPT-4o Mini cost:', cost1);
// Expected: ~$0.000045 (100*0.15/1M + 50*0.6/1M)

// Test Claude 3.5 Sonnet cost
const cost2 = AICostCalculator.calculateCost({
  provider: 'claude',
  model: 'claude-3-5-sonnet-20241022',
  promptTokens: 1000,
  completionTokens: 500
});

console.log('Claude 3.5 Sonnet cost:', cost2);
// Expected: ~$0.0105 (1000*3/1M + 500*15/1M)
```

---

### Test 5: Encryption Test

```javascript
// Run this in Node.js console

const { EncryptionHelper } = require('./server/services/ai');

// Test encryption
const testKey = 'sk-test-api-key-12345';
const encrypted = EncryptionHelper.encrypt(testKey);
console.log('Encrypted:', encrypted);

// Test decryption
const decrypted = EncryptionHelper.decrypt(encrypted);
console.log('Decrypted:', decrypted);

// Verify match
console.log('Match:', testKey === decrypted);
// Expected: true

// Test masking
const masked = EncryptionHelper.maskApiKey(testKey);
console.log('Masked:', masked);
// Expected: sk-t****************2345
```

---

## 🐛 Test Scenarios & Expected Results

### Scenario 1: First Time User

**Steps:**
1. User creates account
2. User creates a bot
3. User clicks "AI Config"

**Expected:**
- ✅ No existing configuration found
- ✅ Default values populated
- ✅ Setup tab active by default
- ✅ Save button enabled

---

### Scenario 2: Using Platform Key

**Steps:**
1. Server has `OPENAI_API_KEY` in .env
2. User configures AI without providing key
3. User saves configuration
4. User tests connection

**Expected:**
- ✅ Configuration saves successfully
- ✅ Test connection uses platform key
- ✅ Test connection succeeds
- ✅ Chat works using platform key

---

### Scenario 3: Using Custom Key (BYO)

**Steps:**
1. User provides own API key
2. User saves configuration
3. User tests connection

**Expected:**
- ✅ Key is encrypted in database
- ✅ Test connection uses user's key
- ✅ Usage tracked to user's organization
- ✅ User pays for their own usage

---

### Scenario 4: Context Window Test

**Steps:**
1. Set context_window to 5
2. Send messages 1-10
3. On message 11, reference message 1

**Expected:**
- ✅ Messages 1-5 not in context (forgotten)
- ✅ Messages 6-10 in context (remembered)
- ✅ AI doesn't recall message 1
- ✅ AI recalls messages 6-10

---

### Scenario 5: Cost Tracking

**Steps:**
1. Send 10 test messages
2. Check usage stats

**Expected:**
- ✅ 10 entries in ai_usage_logs
- ✅ Token counts are accurate
- ✅ Cost calculations match pricing
- ✅ Response times logged
- ✅ All statuses are 'success'

---

### Scenario 6: Error Handling

**Test 6a: Invalid API Key**

**Expected:**
- ✅ Error message: "Invalid API key"
- ✅ Status: 'error' in logs
- ✅ No cost charged
- ✅ User sees friendly error

**Test 6b: Rate Limit**

**Expected:**
- ✅ Error message about rate limiting
- ✅ Status: 'rate_limited' in logs
- ✅ Suggestion to retry later

**Test 6c: Network Error**

**Expected:**
- ✅ Error message about connectivity
- ✅ Suggestion to check connection
- ✅ Graceful failure

---

### Scenario 7: Permission Testing

**Test 7a: Viewer Role**

**Expected:**
- ✅ Can view AI config
- ✅ Can test AI
- ✅ CANNOT create/update config
- ✅ CANNOT delete config

**Test 7b: Member Role**

**Expected:**
- ✅ Can view AI config
- ✅ Can create/update config
- ✅ Can test AI
- ✅ CANNOT delete config

**Test 7c: Admin Role**

**Expected:**
- ✅ Can view AI config
- ✅ Can create/update config
- ✅ Can test AI
- ✅ CAN delete config

---

### Scenario 8: Multi-Organization Isolation

**Steps:**
1. User A in Org 1 configures AI
2. User B in Org 2 tries to access User A's bot

**Expected:**
- ✅ User B cannot see User A's bot
- ✅ 404 error returned
- ✅ No data leakage
- ✅ Organization isolation maintained

---

## 📊 Performance Tests

### Load Test: Concurrent Requests

```bash
# Install hey (HTTP load testing tool)
# https://github.com/rakyll/hey

# Test 100 concurrent requests
hey -n 100 -c 10 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Organization-ID: YOUR_ORG_ID" \
  http://localhost:5000/api/ai/providers
```

**Expected:**
- ✅ All requests succeed (200 OK)
- ✅ Average response time < 100ms
- ✅ No errors
- ✅ No database locks

---

### Stress Test: Large Context

**Steps:**
1. Set context_window to 50
2. Send 50 messages
3. Send 51st message

**Expected:**
- ✅ Response includes last 50 messages
- ✅ Tokens used increases appropriately
- ✅ Cost reflects larger context
- ✅ Response time increases (normal)

---

## ✅ Acceptance Criteria

AI integration is considered complete when:

- [x] All API endpoints return correct responses
- [x] All UI components render correctly
- [x] Configuration can be saved and loaded
- [x] Chat functionality works with both providers
- [x] Context window maintains conversation
- [x] Usage tracking is accurate
- [x] Cost calculations are correct
- [x] Encryption/decryption works
- [x] RBAC permissions enforced
- [x] Organization isolation maintained
- [x] Error handling is graceful
- [x] Loading states display
- [x] Success/error messages show
- [x] No console errors
- [x] No memory leaks

---

## 🎯 Final Validation

### Checklist for Production Release

Before deploying to production:

- [ ] Run all automated tests - all pass
- [ ] Complete manual UI testing - no issues
- [ ] Verify database migration in production DB
- [ ] Set production API keys in .env
- [ ] Generate secure AI_ENCRYPTION_SECRET
- [ ] Test with production API keys
- [ ] Monitor first 100 AI requests
- [ ] Set up cost alerts in OpenAI/Anthropic dashboards
- [ ] Configure rate limiting
- [ ] Set up error monitoring (Sentry, etc.)
- [ ] Prepare rollback plan
- [ ] Document for team
- [ ] Train support team

---

## 📞 Reporting Issues

If tests fail:

1. **Document the failure:**
   - What test failed?
   - What was expected?
   - What actually happened?
   - Error messages?
   - Screenshots?

2. **Check logs:**
   - Server console output
   - Browser console
   - Database logs
   - Network tab in DevTools

3. **Verify setup:**
   - Dependencies installed?
   - Migration ran?
   - Environment variables set?
   - Server restarted?

4. **Try fixes:**
   - Clear database and re-migrate
   - Reinstall dependencies
   - Restart server
   - Clear browser cache

---

## 🎉 Success!

If all tests pass, congratulations! Your AI integration is production-ready.

**Next steps:**
- Deploy to production
- Monitor usage and costs
- Collect user feedback
- Iterate and improve

Happy testing! 🚀
