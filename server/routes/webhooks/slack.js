/**
 * Slack Webhook Routes
 * Handles incoming events, commands, and interactions from Slack
 */

const express = require('express');
const router = express.Router();
const slackService = require('../../services/channels/slackService');
const db = require('../../db');

// Raw body parser for signature verification
const rawBodyParser = express.raw({ type: 'application/json' });

/**
 * Middleware to verify Slack signature
 */
const verifySlackSignature = async (req, res, next) => {
  const signature = req.headers['x-slack-signature'];
  const timestamp = req.headers['x-slack-request-timestamp'];
  const rawBody = req.rawBody || JSON.stringify(req.body);

  if (!signature || !timestamp) {
    return res.status(401).json({ error: 'Missing signature headers' });
  }

  // Get signing secret from database based on team_id in payload
  let signingSecret = process.env.SLACK_SIGNING_SECRET;

  // For events, the team_id is in the root
  // For interactions, it's in the parsed payload
  let teamId;
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    teamId = body.team_id || body.team?.id;

    if (teamId) {
      const channel = await db('slack_channels')
        .where({ team_id: teamId, is_active: true })
        .first();
      if (channel?.signing_secret) {
        signingSecret = channel.signing_secret;
      }
    }
  } catch (e) {
    // Continue with default signing secret
  }

  if (!signingSecret) {
    return res.status(401).json({ error: 'Configuration error' });
  }

  const isValid = slackService.verifySignature(
    signingSecret,
    signature,
    timestamp,
    rawBody
  );

  if (!isValid) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  next();
};

/**
 * POST /api/webhooks/slack/events
 * Handle Slack Event API subscriptions
 */
router.post('/events', verifySlackSignature, async (req, res) => {
  try {
    const eventData = slackService.handleEventCallback(req.body);

    // Handle URL verification challenge
    if (eventData.type === 'url_verification') {
      return res.json({ challenge: eventData.challenge });
    }

    // Find the Slack channel
    const channel = await db('slack_channels')
      .where({ team_id: eventData.teamId, is_active: true })
      .first();

    if (!channel) {
      return res.status(200).json({ ok: true }); // Still acknowledge
    }

    // Store event for processing
    await db('slack_messages').insert({
      channel_id: channel.id,
      event_type: eventData.type,
      user_id: eventData.userId,
      slack_channel_id: eventData.channelId,
      message_text: eventData.text,
      message_ts: eventData.ts,
      thread_ts: eventData.threadTs,
      raw_data: JSON.stringify(req.body),
      created_at: new Date()
    });

    // Process message events
    if (eventData.type === 'message' || eventData.type === 'app_mention') {
      // Ignore bot messages to prevent loops
      if (eventData.botId) {
        return res.status(200).json({ ok: true });
      }

      await routeMessageToBotEngine(channel, eventData);
    }

    // Acknowledge immediately
    res.status(200).json({ ok: true });

  } catch (error) {
    // Slack Events Error - silent fail
    res.status(200).json({ ok: true }); // Still acknowledge
  }
});

/**
 * POST /api/webhooks/slack/commands
 * Handle Slack slash commands
 */
router.post('/commands', verifySlackSignature, async (req, res) => {
  try {
    // Parse URL-encoded body
    const payload = req.body;
    const commandData = slackService.handleSlashCommand(payload);

    // Find the Slack channel
    const channel = await db('slack_channels')
      .where({ team_id: commandData.teamId, is_active: true })
      .first();

    if (!channel) {
      return res.json({
        response_type: 'ephemeral',
        text: 'This workspace is not connected to BotBuilder.'
      });
    }

    // Store command
    await db('slack_commands').insert({
      channel_id: channel.id,
      command: commandData.command,
      text: commandData.text,
      user_id: commandData.userId,
      user_name: commandData.userName,
      slack_channel_id: commandData.channelId,
      response_url: commandData.responseUrl,
      trigger_id: commandData.triggerId,
      created_at: new Date()
    });

    // Process command
    const response = await processSlashCommand(channel, commandData);

    res.json(response);

  } catch (error) {
    // Slack Commands Error - silent fail
    res.json({
      response_type: 'ephemeral',
      text: 'An error occurred processing your command.'
    });
  }
});

/**
 * POST /api/webhooks/slack/interactive
 * Handle Slack interactive messages (buttons, menus, modals)
 */
router.post('/interactive', verifySlackSignature, async (req, res) => {
  try {
    // Slack sends interactive payloads as URL-encoded 'payload' field
    const payloadString = req.body.payload;
    const payload = JSON.parse(payloadString);
    const interactionData = slackService.handleInteractiveMessage(payload);

    // Find the Slack channel
    const channel = await db('slack_channels')
      .where({ team_id: interactionData.teamId, is_active: true })
      .first();

    if (!channel) {
      return res.status(200).json({ ok: true });
    }

    // Store interaction
    await db('slack_interactions').insert({
      channel_id: channel.id,
      interaction_type: interactionData.type,
      user_id: interactionData.userId,
      user_name: interactionData.userName,
      slack_channel_id: interactionData.channelId,
      trigger_id: interactionData.triggerId,
      response_url: interactionData.responseUrl,
      raw_data: JSON.stringify(payload),
      created_at: new Date()
    });

    // Process interaction
    const response = await processInteraction(channel, interactionData);

    // For view submissions, return empty body or errors
    if (interactionData.type === 'view_submission') {
      if (response?.errors) {
        return res.json({ response_action: 'errors', errors: response.errors });
      }
      return res.status(200).json({ response_action: response?.action || 'clear' });
    }

    // Acknowledge immediately
    res.status(200).json(response || { ok: true });

  } catch (error) {
    // Slack Interactive Error - silent fail
    res.status(200).json({ ok: true });
  }
});

/**
 * Route message to bot engine for AI processing
 */
async function routeMessageToBotEngine(channel, eventData) {
  try {
    const bot = await db('bots')
      .where({ id: channel.bot_id })
      .first();

    if (!bot || bot.status !== 'active') {
      return;
    }

    // Skip empty messages
    if (!eventData.text) {
      return;
    }

    // Process through bot engine
    const response = await processBotMessage(bot, channel, eventData);

    if (response) {
      // Send response to Slack
      const blocks = response.blocks || [
        slackService.buildTextBlock(response.text)
      ];

      await slackService.sendMessage(
        channel.team_id,
        channel.bot_token,
        eventData.channelId,
        response.text,
        blocks,
        { threadTs: eventData.threadTs || eventData.ts }
      );
    }

  } catch (error) {
    // Slack Error routing message - silent fail
  }
}

/**
 * Process slash command
 */
async function processSlashCommand(channel, commandData) {
  const command = commandData.command.toLowerCase();
  const args = commandData.text?.trim();

  switch (command) {
    case '/botbuilder':
    case '/bb':
      if (!args) {
        return {
          response_type: 'ephemeral',
          blocks: [
            slackService.buildTextBlock('*BotBuilder Commands*'),
            slackService.buildTextBlock(
              '`/bb help` - Show help\n' +
              '`/bb status` - Bot status\n' +
              '`/bb ask <question>` - Ask the bot'
            )
          ]
        };
      }

      if (args === 'help') {
        return {
          response_type: 'ephemeral',
          text: 'BotBuilder Help: Use `/bb ask <question>` to ask the bot a question.'
        };
      }

      if (args === 'status') {
        const bot = await db('bots').where({ id: channel.bot_id }).first();
        return {
          response_type: 'ephemeral',
          text: `Bot Status: ${bot?.status || 'Unknown'}\nBot Name: ${bot?.name || 'Not configured'}`
        };
      }

      if (args.startsWith('ask ')) {
        const question = args.substring(4);
        // Process through bot
        return {
          response_type: 'in_channel',
          text: `Processing: "${question}"\n\n_AI response will appear shortly..._`
        };
      }

      return {
        response_type: 'ephemeral',
        text: `Unknown command. Use \`/bb help\` for available commands.`
      };

    default:
      return {
        response_type: 'ephemeral',
        text: 'Unknown command'
      };
  }
}

/**
 * Process interactive action
 */
async function processInteraction(channel, interactionData) {
  switch (interactionData.type) {
    case 'block_actions':
      for (const action of interactionData.actions || []) {
        // Handle specific actions based on action_id
      }
      break;

    case 'view_submission':
      break;
  }

  return null;
}

/**
 * Process message through bot AI engine
 */
async function processBotMessage(bot, channel, eventData) {
  try {
    // Clean message text (remove bot mention)
    let text = eventData.text || '';
    text = text.replace(/<@[A-Z0-9]+>/g, '').trim();

    if (!text) {
      return null;
    }

    // Here you would integrate with your AI service
    return {
      text: `Received: "${text}"\n\n_AI processing connected to main bot engine._`,
      blocks: [
        slackService.buildTextBlock(`*Message received:* ${text}`),
        slackService.buildDivider(),
        slackService.buildContextBlock([
          { text: `_Processing by ${bot.name}_` }
        ])
      ]
    };

  } catch (error) {
    // Slack Error processing message - silent fail
    return {
      text: 'Sorry, I encountered an error processing your message.'
    };
  }
}

module.exports = router;
