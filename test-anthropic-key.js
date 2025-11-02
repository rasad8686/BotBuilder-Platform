/**
 * Test Anthropic API Key
 * Verifies that the ANTHROPIC_API_KEY environment variable is set and works
 */

require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');

async function testAnthropicKey() {
  console.log('\n🔍 Testing Anthropic API Key...\n');

  // Check if key exists
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.error('❌ ANTHROPIC_API_KEY not found in environment variables');
    console.error('   Please add it to your .env file');
    process.exit(1);
  }

  // Trim and validate
  const cleanApiKey = apiKey.trim();

  console.log('✅ Environment variable found');
  console.log(`   Key prefix: ${cleanApiKey.substring(0, 15)}...`);
  console.log(`   Key length: ${cleanApiKey.length} characters`);

  // Check if key has correct format
  if (!cleanApiKey.startsWith('sk-ant-')) {
    console.warn('⚠️  Warning: API key does not start with "sk-ant-"');
    console.warn('   This might not be a valid Anthropic API key');
  }

  // Test API call
  console.log('\n🧪 Testing API call with Claude...\n');

  try {
    const client = new Anthropic({
      apiKey: cleanApiKey
    });

    const response = await client.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 50,
      messages: [
        { role: 'user', content: 'Respond with "OK" if you receive this test message.' }
      ]
    });

    console.log('✅ API call successful!');
    console.log(`   Model: ${response.model}`);
    console.log(`   Response: ${response.content[0].text}`);
    console.log(`   Input tokens: ${response.usage.input_tokens}`);
    console.log(`   Output tokens: ${response.usage.output_tokens}`);
    console.log('\n🎉 Anthropic API key is working correctly!\n');

  } catch (error) {
    console.error('\n❌ API call failed:');
    console.error(`   Error type: ${error.type}`);
    console.error(`   Error status: ${error.status}`);
    console.error(`   Error message: ${error.message}`);

    if (error.status === 401) {
      console.error('\n🔑 Authentication failed!');
      console.error('   This means the API key is invalid or expired.');
      console.error('   Please check:');
      console.error('   1. The key is copied correctly (no extra spaces)');
      console.error('   2. The key is still valid in your Anthropic Console');
      console.error('   3. The key starts with "sk-ant-"');
    }

    process.exit(1);
  }
}

testAnthropicKey();
