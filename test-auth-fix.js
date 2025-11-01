/**
 * Test script to verify auth and bot creation fix
 * This tests that user_id from JWT matches database user_id
 */

const axios = require('axios');

const API_URL = 'http://localhost:5003';
const testEmail = `test_${Date.now()}@example.com`;
const testData = {
  username: 'TestUser',
  email: testEmail,
  password: 'test123456'
};

async function testAuthFlow() {
  console.log('🧪 Testing Auth & Bot Creation Fix...\n');

  try {
    // Step 1: Register new user
    console.log('1️⃣ Registering new user...');
    const registerResponse = await axios.post(`${API_URL}/auth/register`, testData);

    if (!registerResponse.data.success) {
      console.error('❌ Registration failed:', registerResponse.data);
      return;
    }

    console.log('✅ Registration successful!');
    console.log('   User ID:', registerResponse.data.user.id);
    console.log('   Username:', registerResponse.data.user.username);
    console.log('   Email:', registerResponse.data.user.email);

    const token = registerResponse.data.token;
    const userId = registerResponse.data.user.id;

    // Step 2: Verify JWT contains correct user_id
    console.log('\n2️⃣ Verifying JWT token...');
    const jwt = require('jsonwebtoken');
    const decoded = jwt.decode(token);
    console.log('   JWT user.id:', decoded.id);

    if (decoded.id !== userId) {
      console.error('❌ JWT user_id mismatch!');
      console.error('   Database user_id:', userId);
      console.error('   JWT user_id:', decoded.id);
      return;
    }
    console.log('✅ JWT contains correct user_id');

    // Step 3: Create a bot (this should work now!)
    console.log('\n3️⃣ Creating bot with authenticated user...');
    const botData = {
      name: 'Test Bot',
      platform: 'telegram',
      description: 'Testing bot creation fix'
    };

    const botResponse = await axios.post(`${API_URL}/api/bots`, botData, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!botResponse.data.success) {
      console.error('❌ Bot creation failed:', botResponse.data);
      return;
    }

    console.log('✅ Bot created successfully!');
    console.log('   Bot ID:', botResponse.data.bot.id);
    console.log('   Bot Name:', botResponse.data.bot.name);
    console.log('   Bot Platform:', botResponse.data.bot.platform);
    console.log('   Bot user_id:', botResponse.data.bot.user_id);

    // Step 4: Verify bot user_id matches JWT user_id
    console.log('\n4️⃣ Verifying bot user_id...');
    if (botResponse.data.bot.user_id !== userId) {
      console.error('❌ Bot user_id mismatch!');
      console.error('   Expected:', userId);
      console.error('   Got:', botResponse.data.bot.user_id);
      return;
    }

    console.log('✅ Bot user_id matches database user_id!');

    console.log('\n🎉 ═══════════════════════════════════════');
    console.log('🎉 ALL TESTS PASSED!');
    console.log('🎉 Auth fix is working correctly!');
    console.log('🎉 ═══════════════════════════════════════');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    }
  }
}

// Run the test
testAuthFlow();
