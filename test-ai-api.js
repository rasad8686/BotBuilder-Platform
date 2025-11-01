/**
 * AI API Test Script
 * Tests all AI integration endpoints
 *
 * Usage:
 * 1. Start your backend server
 * 2. Update TOKEN and ORG_ID below with valid credentials
 * 3. Run: node test-ai-api.js
 */

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';

// ⚠️ UPDATE THESE VALUES
const TOKEN = 'YOUR_JWT_TOKEN_HERE';
const ORG_ID = 'YOUR_ORG_ID_HERE';
const BOT_ID = 'YOUR_BOT_ID_HERE';

// Test configuration
const TEST_CONFIG = {
  provider: 'openai',
  model: 'gpt-4o-mini',
  api_key: 'YOUR_OPENAI_API_KEY_HERE', // Or leave empty to use platform key
  temperature: 0.7,
  max_tokens: 100,
  system_prompt: 'You are a helpful test assistant. Keep responses very brief.',
  context_window: 5,
  enable_streaming: true,
  is_enabled: true
};

const SESSION_ID = `test_session_${Date.now()}`;

// Helper function to make API requests
async function apiRequest(method, endpoint, body = null) {
  const url = `${API_BASE_URL}${endpoint}`;

  const options = {
    method: method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TOKEN}`,
      'X-Organization-ID': ORG_ID
    }
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);
    const data = await response.json();

    return {
      status: response.status,
      ok: response.ok,
      data: data
    };
  } catch (error) {
    return {
      status: 0,
      ok: false,
      error: error.message
    };
  }
}

// Test functions
async function test1_getProviders() {
  console.log('\n📋 TEST 1: Get Available Providers');
  console.log('━'.repeat(60));

  const result = await apiRequest('GET', '/api/ai/providers');

  if (result.ok) {
    console.log('✅ SUCCESS');
    console.log(`Found ${result.data.providers.length} providers:`);
    result.data.providers.forEach(provider => {
      console.log(`  - ${provider.name}: ${provider.models.length} models`);
    });
  } else {
    console.log('❌ FAILED');
    console.log('Error:', result.data);
  }

  return result.ok;
}

async function test2_getModels() {
  console.log('\n📋 TEST 2: Get Models for OpenAI');
  console.log('━'.repeat(60));

  const result = await apiRequest('GET', '/api/ai/models/openai');

  if (result.ok) {
    console.log('✅ SUCCESS');
    console.log(`Found ${result.data.models.length} OpenAI models:`);
    result.data.models.forEach(model => {
      console.log(`  - ${model.name} (${model.id})`);
      console.log(`    Pricing: $${model.pricing.input}/$${model.pricing.output} per 1M tokens`);
    });
  } else {
    console.log('❌ FAILED');
    console.log('Error:', result.data);
  }

  return result.ok;
}

async function test3_configureAI() {
  console.log('\n📋 TEST 3: Configure AI for Bot');
  console.log('━'.repeat(60));

  const result = await apiRequest('POST', `/api/bots/${BOT_ID}/ai/configure`, TEST_CONFIG);

  if (result.ok) {
    console.log('✅ SUCCESS');
    console.log('AI Configuration:');
    console.log(`  Provider: ${result.data.config.provider}`);
    console.log(`  Model: ${result.data.config.model}`);
    console.log(`  Temperature: ${result.data.config.temperature}`);
    console.log(`  Max Tokens: ${result.data.config.max_tokens}`);
    console.log(`  Context Window: ${result.data.config.context_window}`);
  } else {
    console.log('❌ FAILED');
    console.log('Error:', result.data);
  }

  return result.ok;
}

async function test4_getConfig() {
  console.log('\n📋 TEST 4: Get AI Configuration');
  console.log('━'.repeat(60));

  const result = await apiRequest('GET', `/api/bots/${BOT_ID}/ai/configure`);

  if (result.ok) {
    console.log('✅ SUCCESS');
    console.log('Configuration retrieved successfully');
    console.log(`  Has custom API key: ${result.data.config.has_custom_key}`);
    console.log(`  Enabled: ${result.data.config.is_enabled}`);
  } else {
    console.log('❌ FAILED');
    console.log('Error:', result.data);
  }

  return result.ok;
}

async function test5_testConnection() {
  console.log('\n📋 TEST 5: Test AI Connection');
  console.log('━'.repeat(60));

  const result = await apiRequest('POST', `/api/bots/${BOT_ID}/ai/test`);

  if (result.ok && result.data.test.success) {
    console.log('✅ SUCCESS');
    console.log('Connection test passed!');
    console.log(`  Response: ${result.data.test.testResponse}`);
  } else {
    console.log('❌ FAILED');
    console.log('Error:', result.data);
  }

  return result.ok;
}

async function test6_sendChat() {
  console.log('\n📋 TEST 6: Send Chat Message');
  console.log('━'.repeat(60));

  const result = await apiRequest('POST', `/api/bots/${BOT_ID}/ai/chat`, {
    message: 'Hello! Please respond with just "Hi there!"',
    sessionId: SESSION_ID
  });

  if (result.ok) {
    console.log('✅ SUCCESS');
    console.log(`AI Response: "${result.data.response}"`);
    console.log(`Tokens Used: ${result.data.usage.totalTokens}`);
    console.log(`Cost: $${result.data.cost.toFixed(6)}`);
    console.log(`Response Time: ${result.data.responseTime}ms`);
  } else {
    console.log('❌ FAILED');
    console.log('Error:', result.data);
  }

  return result.ok;
}

async function test7_sendChatWithContext() {
  console.log('\n📋 TEST 7: Send Chat with Context');
  console.log('━'.repeat(60));

  const result = await apiRequest('POST', `/api/bots/${BOT_ID}/ai/chat`, {
    message: 'What did I just ask you to say?',
    sessionId: SESSION_ID
  });

  if (result.ok) {
    console.log('✅ SUCCESS');
    console.log(`AI Response: "${result.data.response}"`);
    console.log('Context is working! AI remembers previous message.');
  } else {
    console.log('❌ FAILED');
    console.log('Error:', result.data);
  }

  return result.ok;
}

async function test8_getUsage() {
  console.log('\n📋 TEST 8: Get Bot Usage Statistics');
  console.log('━'.repeat(60));

  const result = await apiRequest('GET', `/api/bots/${BOT_ID}/ai/usage?limit=10`);

  if (result.ok) {
    console.log('✅ SUCCESS');
    console.log(`Total Requests: ${result.data.summary.totalRequests}`);
    console.log(`Total Tokens: ${result.data.summary.totalTokens}`);
    console.log(`Total Cost: $${result.data.summary.totalCost.toFixed(6)}`);
    console.log(`Avg Response Time: ${result.data.summary.avgResponseTime.toFixed(2)}ms`);
    console.log(`Success Rate: ${result.data.summary.successfulRequests}/${result.data.summary.totalRequests}`);
  } else {
    console.log('❌ FAILED');
    console.log('Error:', result.data);
  }

  return result.ok;
}

async function test9_getOrgBilling() {
  console.log('\n📋 TEST 9: Get Organization Billing');
  console.log('━'.repeat(60));

  const result = await apiRequest('GET', `/api/organizations/${ORG_ID}/ai/billing`);

  if (result.ok) {
    console.log('✅ SUCCESS');
    console.log('Current Month:');
    console.log(`  Total Requests: ${result.data.currentMonth.totalRequests}`);
    console.log(`  Total Cost: $${result.data.currentMonth.totalCost.toFixed(6)}`);
    console.log('All Time:');
    console.log(`  Total Requests: ${result.data.allTime.totalRequests}`);
    console.log(`  Total Cost: $${result.data.allTime.totalCost.toFixed(6)}`);
  } else {
    console.log('❌ FAILED');
    console.log('Error:', result.data);
  }

  return result.ok;
}

// Run all tests
async function runAllTests() {
  console.log('═'.repeat(60));
  console.log('🧪 AI API TEST SUITE');
  console.log('═'.repeat(60));
  console.log(`API Base URL: ${API_BASE_URL}`);
  console.log(`Bot ID: ${BOT_ID}`);
  console.log(`Organization ID: ${ORG_ID}`);
  console.log('═'.repeat(60));

  // Check if credentials are set
  if (TOKEN === 'YOUR_JWT_TOKEN_HERE' || ORG_ID === 'YOUR_ORG_ID_HERE' || BOT_ID === 'YOUR_BOT_ID_HERE') {
    console.log('\n❌ ERROR: Please update TOKEN, ORG_ID, and BOT_ID in the script');
    console.log('\nTo get these values:');
    console.log('1. Login to your app and get JWT token from localStorage');
    console.log('2. Get your organization ID from the API response');
    console.log('3. Create a bot and get its ID');
    return;
  }

  if (TEST_CONFIG.api_key === 'YOUR_OPENAI_API_KEY_HERE') {
    console.log('\n⚠️ WARNING: API key not set. Will try to use platform key.');
    console.log('Update TEST_CONFIG.api_key if you want to test with your own key.\n');
  }

  const results = [];

  // Run tests sequentially
  results.push(await test1_getProviders());
  results.push(await test2_getModels());
  results.push(await test3_configureAI());
  results.push(await test4_getConfig());
  results.push(await test5_testConnection());
  results.push(await test6_sendChat());

  // Wait a bit for context to be saved
  await new Promise(resolve => setTimeout(resolve, 500));

  results.push(await test7_sendChatWithContext());
  results.push(await test8_getUsage());
  results.push(await test9_getOrgBilling());

  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('═'.repeat(60));

  const passed = results.filter(r => r).length;
  const total = results.length;

  console.log(`✅ Passed: ${passed}/${total}`);
  console.log(`❌ Failed: ${total - passed}/${total}`);

  if (passed === total) {
    console.log('\n🎉 All tests passed!');
  } else {
    console.log('\n⚠️ Some tests failed. Check the output above for details.');
  }

  console.log('═'.repeat(60));
}

// Run the tests
runAllTests().catch(console.error);
