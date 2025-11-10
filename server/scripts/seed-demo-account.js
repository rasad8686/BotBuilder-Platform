const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../db');

/**
 * Demo Account Seeding Script
 * Creates a fully populated demo account with:
 * - Demo user & organization
 * - Sample bot with AI config
 * - Sample conversations
 * - Mock analytics data
 */

async function seedDemoAccount() {
  try {
    console.log('\n========================================');
    console.log('🎭 SEEDING DEMO ACCOUNT...');
    console.log('========================================\n');

    // 1. Create Demo User
    console.log('Step 1: Creating demo user...');
    const demoEmail = 'demo@botbuilder.com';
    const demoPassword = 'DemoUser2025!';

    // Check if demo user already exists
    const existingUser = await db.query(
      'SELECT id, email FROM users WHERE email = $1',
      [demoEmail]
    );

    let demoUserId;
    if (existingUser.rows.length > 0) {
      console.log('✅ Demo user already exists');
      demoUserId = existingUser.rows[0].id;
    } else {
      const hashedPassword = await bcrypt.hash(demoPassword, 10);
      const userResult = await db.query(
        `INSERT INTO users (name, email, password_hash, email_verified, created_at, updated_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         RETURNING id, name, email`,
        ['Demo User', demoEmail, hashedPassword, true]
      );
      demoUserId = userResult.rows[0].id;
      console.log(`✅ Demo user created: ${demoEmail} (ID: ${demoUserId})`);
    }

    // 2. Create Demo Organization
    console.log('\nStep 2: Creating demo organization...');
    const existingOrg = await db.query(
      'SELECT id FROM organizations WHERE slug = $1',
      ['demo-organization']
    );

    let demoOrgId;
    if (existingOrg.rows.length > 0) {
      console.log('✅ Demo organization already exists');
      demoOrgId = existingOrg.rows[0].id;
    } else {
      const orgResult = await db.query(
        `INSERT INTO organizations (name, slug, owner_id, plan_tier, settings, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         RETURNING id, name, slug`,
        [
          'Demo Organization',
          'demo-organization',
          demoUserId,
          'enterprise',
          JSON.stringify({
            features: ['unlimited_bots', 'advanced_analytics', 'webhooks', 'api_access'],
            is_demo: true
          })
        ]
      );
      demoOrgId = orgResult.rows[0].id;
      console.log(`✅ Demo organization created (ID: ${demoOrgId})`);

      // Add user to organization
      await db.query(
        `INSERT INTO organization_members (org_id, user_id, role, status, joined_at)
         VALUES ($1, $2, 'admin', 'active', CURRENT_TIMESTAMP)`,
        [demoOrgId, demoUserId]
      );
      console.log('✅ User added to demo organization');
    }

    // 3. Create Sample Bot
    console.log('\nStep 3: Creating sample bot...');
    const existingBot = await db.query(
      'SELECT id FROM bots WHERE name = $1 AND user_id = $2',
      ['Customer Support Bot', demoUserId]
    );

    let demoBotId;
    if (existingBot.rows.length > 0) {
      console.log('✅ Sample bot already exists');
      demoBotId = existingBot.rows[0].id;
    } else {
      const api_token = crypto.randomBytes(32).toString('hex');
      const botResult = await db.query(
        `INSERT INTO bots (
          user_id, organization_id, name, description, platform,
          api_token, webhook_url, is_active, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id, name`,
        [
          demoUserId,
          demoOrgId,
          'Customer Support Bot',
          'AI-powered customer support assistant with natural language understanding',
          'telegram',
          api_token,
          'https://api.telegram.org/bot' + api_token,
          true
        ]
      );
      demoBotId = botResult.rows[0].id;
      console.log(`✅ Sample bot created: Customer Support Bot (ID: ${demoBotId})`);
    }

    // 4. Create AI Configuration for the bot (if table exists)
    console.log('\nStep 4: Creating AI configuration...');
    try {
      const existingAiConfig = await db.query(
        'SELECT id FROM ai_configurations WHERE bot_id = $1',
        [demoBotId]
      );

      if (existingAiConfig.rows.length === 0) {
        await db.query(
          `INSERT INTO ai_configurations (
            bot_id, provider, model, system_prompt,
            temperature, max_tokens, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [
            demoBotId,
            'openai',
            'gpt-4',
            'You are a helpful customer support assistant. Be friendly, professional, and solve customer issues efficiently.',
            0.7,
            500
          ]
        );
        console.log('✅ AI configuration created');
      } else {
        console.log('✅ AI configuration already exists');
      }
    } catch (error) {
      console.log('⚠️  AI configuration table not found, skipping...');
    }

    // 5. Create Sample Messages/Conversations
    console.log('\nStep 5: Creating sample conversations...');
    const sampleMessages = [
      {
        type: 'user_message',
        content: 'Hello, I need help with my account',
        timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7 days ago
      },
      {
        type: 'bot_response',
        content: 'Hello! I\'d be happy to help you with your account. What specific issue are you experiencing?',
        timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      },
      {
        type: 'user_message',
        content: 'I can\'t reset my password',
        timestamp: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)
      },
      {
        type: 'bot_response',
        content: 'I can help you reset your password. Please click on the "Forgot Password" link on the login page and follow the instructions.',
        timestamp: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)
      },
      {
        type: 'user_message',
        content: 'What are your business hours?',
        timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
      },
      {
        type: 'bot_response',
        content: 'Our support team is available 24/7 to assist you. However, live agent response times may vary during peak hours.',
        timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
      },
      {
        type: 'user_message',
        content: 'How do I upgrade my plan?',
        timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
      },
      {
        type: 'bot_response',
        content: 'To upgrade your plan, go to Settings > Billing and select the plan that best fits your needs. You\'ll see a comparison of features and pricing.',
        timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
      },
      {
        type: 'user_message',
        content: 'Thanks! That was helpful',
        timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      },
      {
        type: 'bot_response',
        content: 'You\'re welcome! If you have any other questions, feel free to ask. I\'m here to help!',
        timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      }
    ];

    const existingMessages = await db.query(
      'SELECT COUNT(*) as count FROM bot_messages WHERE bot_id = $1',
      [demoBotId]
    );

    if (parseInt(existingMessages.rows[0].count) === 0) {
      for (const msg of sampleMessages) {
        await db.query(
          `INSERT INTO bot_messages (bot_id, organization_id, message_type, content, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $5)`,
          [demoBotId, demoOrgId, msg.type, msg.content, msg.timestamp]
        );
      }
      console.log(`✅ Created ${sampleMessages.length} sample messages`);
    } else {
      console.log('✅ Sample messages already exist');
    }

    // 6. Create Sample Webhooks (mock data, if table exists)
    console.log('\nStep 6: Creating sample webhooks...');
    try {
      const existingWebhooks = await db.query(
        'SELECT id FROM webhooks WHERE bot_id = $1',
        [demoBotId]
      );

      if (existingWebhooks.rows.length === 0) {
        await db.query(
          `INSERT INTO webhooks (
            bot_id, name, url, events, is_active,
            created_at, updated_at
          )
          VALUES
            ($1, 'Slack Notifications', 'https://hooks.slack.com/services/demo/webhook',
             '["message_received", "bot_response"]', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
            ($1, 'CRM Integration', 'https://api.example.com/crm/webhook',
             '["new_conversation", "conversation_ended"]', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [demoBotId]
        );
        console.log('✅ Created 2 sample webhooks');
      } else {
        console.log('✅ Sample webhooks already exist');
      }
    } catch (error) {
      console.log('⚠️  Webhooks table not found, skipping...');
    }

    console.log('\n========================================');
    console.log('✅ DEMO ACCOUNT SEEDING COMPLETE!');
    console.log('========================================');
    console.log('📧 Email: demo@botbuilder.com');
    console.log('🔑 Password: DemoUser2025!');
    console.log('🏢 Organization: Demo Organization');
    console.log('💎 Plan: Enterprise');
    console.log('🤖 Bots: 1 (Customer Support Bot)');
    console.log('💬 Messages: 10 sample conversations');
    console.log('🔗 Webhooks: 2 sample webhooks');
    console.log('========================================\n');

  } catch (error) {
    console.error('\n❌ ERROR SEEDING DEMO ACCOUNT:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  seedDemoAccount()
    .then(() => {
      console.log('Demo account seeding completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Demo account seeding failed:', error);
      process.exit(1);
    });
}

module.exports = { seedDemoAccount };
