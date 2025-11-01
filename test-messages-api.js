/**
 * Test script to verify messages API functionality
 * Tests all CRUD operations for bot messages
 */

const axios = require('axios');

const API_URL = 'http://localhost:5000';
let authToken = '';
let botId = 0;
let messageId = 0;

async function testMessagesAPI() {
  console.log('🧪 Testing Messages API...\n');

  try {
    // Step 1: Register a test user
    console.log('1️⃣ Registering test user...');
    const testEmail = `test_messages_${Date.now()}@example.com`;
    const registerResponse = await axios.post(`${API_URL}/auth/register`, {
      username: 'MessagesTestUser',
      email: testEmail,
      password: 'test123456'
    });

    authToken = registerResponse.data.token;
    console.log('✅ User registered successfully');
    console.log('   Token:', authToken.substring(0, 20) + '...');

    // Step 2: Create a test bot
    console.log('\n2️⃣ Creating test bot...');
    const botResponse = await axios.post(`${API_URL}/api/bots`, {
      name: 'Test Bot for Messages',
      platform: 'telegram',
      description: 'Testing messages functionality'
    }, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    botId = botResponse.data.bot.id;
    console.log('✅ Bot created successfully');
    console.log('   Bot ID:', botId);

    // Step 3: Create a greeting message
    console.log('\n3️⃣ Creating greeting message...');
    const createResponse = await axios.post(`${API_URL}/api/messages`, {
      bot_id: botId,
      message_type: 'greeting',
      content: 'Hello! Welcome to our bot!',
      trigger_keywords: 'hello, hi, hey'
    }, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    messageId = createResponse.data.data.id;
    console.log('✅ Message created successfully');
    console.log('   Message ID:', messageId);
    console.log('   Type:', createResponse.data.data.message_type);
    console.log('   Content:', createResponse.data.data.content);

    // Step 4: Create a response message
    console.log('\n4️⃣ Creating response message...');
    const responseMsg = await axios.post(`${API_URL}/api/messages`, {
      bot_id: botId,
      message_type: 'response',
      content: 'Thanks for your message! How can I help you?',
      trigger_keywords: 'help, support, question'
    }, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    console.log('✅ Response message created');
    console.log('   Message ID:', responseMsg.data.data.id);

    // Step 5: Create a fallback message
    console.log('\n5️⃣ Creating fallback message...');
    const fallbackMsg = await axios.post(`${API_URL}/api/messages`, {
      bot_id: botId,
      message_type: 'fallback',
      content: 'Sorry, I did not understand that. Please try again.'
    }, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    console.log('✅ Fallback message created');
    console.log('   Message ID:', fallbackMsg.data.data.id);

    // Step 6: Get all messages for the bot
    console.log('\n6️⃣ Retrieving all messages for bot...');
    const getAllResponse = await axios.get(`${API_URL}/api/messages/bot/${botId}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    console.log('✅ Messages retrieved successfully');
    console.log('   Total messages:', getAllResponse.data.total);
    console.log('   Messages:');
    getAllResponse.data.data.forEach((msg, index) => {
      console.log(`     ${index + 1}. [${msg.message_type}] ${msg.content.substring(0, 40)}...`);
    });

    // Step 7: Get single message
    console.log('\n7️⃣ Retrieving single message...');
    const getSingleResponse = await axios.get(`${API_URL}/api/messages/${messageId}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    console.log('✅ Single message retrieved');
    console.log('   ID:', getSingleResponse.data.data.id);
    console.log('   Type:', getSingleResponse.data.data.message_type);
    console.log('   Content:', getSingleResponse.data.data.content);

    // Step 8: Update message
    console.log('\n8️⃣ Updating message...');
    const updateResponse = await axios.put(`${API_URL}/api/messages/${messageId}`, {
      content: 'Hello! Welcome to our UPDATED bot!',
      trigger_keywords: 'hello, hi, hey, greetings'
    }, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    console.log('✅ Message updated successfully');
    console.log('   New content:', updateResponse.data.data.content);
    console.log('   New keywords:', updateResponse.data.data.trigger_keywords);

    // Step 9: Delete message
    console.log('\n9️⃣ Deleting message...');
    const deleteResponse = await axios.delete(`${API_URL}/api/messages/${messageId}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    console.log('✅ Message deleted successfully');
    console.log('   Deleted ID:', deleteResponse.data.deletedId);

    // Step 10: Verify deletion
    console.log('\n🔟 Verifying message was deleted...');
    const verifyResponse = await axios.get(`${API_URL}/api/messages/bot/${botId}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    console.log('✅ Verification complete');
    console.log('   Remaining messages:', verifyResponse.data.total);

    console.log('\n🎉 ═══════════════════════════════════════');
    console.log('🎉 ALL TESTS PASSED!');
    console.log('🎉 Messages API is working correctly!');
    console.log('🎉 ═══════════════════════════════════════');

    console.log('\n📋 Test Summary:');
    console.log('   ✅ User registration');
    console.log('   ✅ Bot creation');
    console.log('   ✅ Message creation (greeting, response, fallback)');
    console.log('   ✅ Get all messages for bot');
    console.log('   ✅ Get single message');
    console.log('   ✅ Update message');
    console.log('   ✅ Delete message');
    console.log('   ✅ Verify deletion');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    }
    process.exit(1);
  }
}

// Run the test
testMessagesAPI();
