const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../db');
const log = require('../utils/logger');

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
    log.info('SEEDING DEMO ACCOUNT...');

    // 1. Create Demo User
    log.info('Step 1: Creating demo user...');
    const demoEmail = 'demo@botbuilder.com';
    const demoPassword = 'DemoUser2025!';

    // Check if demo user already exists
    const existingUser = await db.query(
      'SELECT id, email FROM users WHERE email = $1',
      [demoEmail]
    );

    let demoUserId;
    if (existingUser.rows.length > 0) {
      log.info('Demo user already exists');
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
      log.info('Demo user created', { email: demoEmail, id: demoUserId });
    }

    // 2. Create Demo Organization
    log.info('Step 2: Creating demo organization...');
    const existingOrg = await db.query(
      'SELECT id FROM organizations WHERE slug = $1',
      ['demo-organization']
    );

    let demoOrgId;
    if (existingOrg.rows.length > 0) {
      log.info('Demo organization already exists');
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
      log.info('Demo organization created', { id: demoOrgId });

      // Add user to organization
      await db.query(
        `INSERT INTO organization_members (org_id, user_id, role, status, joined_at)
         VALUES ($1, $2, 'admin', 'active', CURRENT_TIMESTAMP)`,
        [demoOrgId, demoUserId]
      );
      log.info('User added to demo organization');
    }

    // 3. Create Sample Bot
    log.info('Step 3: Creating sample bot...');
    const existingBot = await db.query(
      'SELECT id FROM bots WHERE name = $1 AND user_id = $2',
      ['Customer Support Bot', demoUserId]
    );

    let demoBotId;
    if (existingBot.rows.length > 0) {
      log.info('Sample bot already exists');
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
      log.info('Sample bot created', { name: 'Customer Support Bot', id: demoBotId });
    }

    // 4. Create AI Configuration for the bot (if table exists)
    log.info('Step 4: Creating AI configuration...');
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
        log.info('AI configuration created');
      } else {
        log.info('AI configuration already exists');
      }
    } catch (error) {
      log.warn('AI configuration table not found, skipping...');
    }

    // 5. Create Sample Messages/Conversations
    log.info('Step 5: Creating sample conversations...');
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
      log.info('Created sample messages', { count: sampleMessages.length });
    } else {
      log.info('Sample messages already exist');
    }

    // 6. Create Sample Webhooks (mock data, if table exists)
    log.info('Step 6: Creating sample webhooks...');
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
        log.info('Created 2 sample webhooks');
      } else {
        log.info('Sample webhooks already exist');
      }
    } catch (error) {
      log.warn('Webhooks table not found, skipping...');
    }

    log.info('DEMO ACCOUNT SEEDING COMPLETE', {
      email: 'demo@botbuilder.com',
      password: 'DemoUser2025!',
      organization: 'Demo Organization',
      plan: 'Enterprise',
      bots: 1,
      messages: 10,
      webhooks: 2
    });

  } catch (error) {
    log.error('ERROR SEEDING DEMO ACCOUNT', { error: error.message });
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  seedDemoAccount()
    .then(() => {
      log.info('Demo account seeding completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      log.error('Demo account seeding failed', { error: error.message });
      process.exit(1);
    });
}

module.exports = { seedDemoAccount };
