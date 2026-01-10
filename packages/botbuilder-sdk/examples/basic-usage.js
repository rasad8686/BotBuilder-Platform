/**
 * BotBuilder SDK - Basic Usage Example
 *
 * This example demonstrates the basic usage of the BotBuilder SDK.
 *
 * Run with: node examples/basic-usage.js
 */

const BotBuilder = require('../src/index');

// Initialize client
const client = new BotBuilder({
  apiKey: process.env.BOTBUILDER_API_KEY || 'your-api-key',
  baseUrl: process.env.BOTBUILDER_API_URL || 'http://localhost:5000',
  debug: true // Enable debug logging
});

async function main() {
  try {
    console.log('=== BotBuilder SDK Example ===\n');

    // 1. Check system status
    console.log('1. Checking system status...');
    const status = await client.getStatus();
    console.log('   Status:', status.status);
    console.log();

    // 2. List existing bots
    console.log('2. Listing bots...');
    const botsResult = await client.bots.list({ page: 1, limit: 5 });
    console.log('   Found', botsResult.bots?.length || 0, 'bots');
    console.log();

    // 3. Create a new bot
    console.log('3. Creating a new bot...');
    const newBot = await client.bots.create({
      name: 'SDK Test Bot',
      platform: 'web',
      language: 'en',
      description: 'Created via BotBuilder SDK'
    });
    console.log('   Created bot:', newBot.name, '(ID:', newBot.id, ')');
    console.log();

    // 4. Update the bot
    console.log('4. Updating the bot...');
    const updatedBot = await client.bots.update(newBot.id, {
      description: 'Updated description via SDK'
    });
    console.log('   Updated description:', updatedBot.description);
    console.log();

    // 5. Configure AI settings
    console.log('5. Configuring AI settings...');
    const aiConfig = await client.bots.updateAIConfig(newBot.id, {
      provider: 'openai',
      model: 'gpt-4o-mini',
      temperature: 0.7,
      max_tokens: 1024,
      system_prompt: 'You are a helpful assistant created via the BotBuilder SDK.'
    });
    console.log('   AI provider:', aiConfig.provider || 'openai');
    console.log('   Model:', aiConfig.model || 'gpt-4o-mini');
    console.log();

    // 6. Send a message
    console.log('6. Sending a message...');
    const response = await client.messages.send(newBot.id, {
      message: 'Hello! What can you do?',
      sessionId: 'sdk-example-session'
    });
    console.log('   User: Hello! What can you do?');
    console.log('   Bot:', response.message?.substring(0, 100) + '...');
    console.log();

    // 7. Get message history
    console.log('7. Getting message history...');
    const history = await client.messages.list(newBot.id, {
      sessionId: 'sdk-example-session',
      limit: 10
    });
    console.log('   Found', history.messages?.length || 0, 'messages');
    console.log();

    // 8. Clean up - delete the test bot
    console.log('8. Cleaning up - deleting test bot...');
    await client.bots.delete(newBot.id);
    console.log('   Bot deleted successfully');
    console.log();

    console.log('=== Example Complete ===');

  } catch (error) {
    console.error('Error:', error.message);

    if (error.name === 'AuthenticationError') {
      console.error('Please check your API key');
    } else if (error.name === 'NotFoundError') {
      console.error('Resource not found');
    }

    process.exit(1);
  }
}

main();
