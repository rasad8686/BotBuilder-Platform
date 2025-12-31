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
  try {
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
  } catch (error) {
    return {
      response_type: 'ephemeral',
      text: 'An error occurred processing your command. Please try again.'
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
 * Process message through bot AI engine with RAG support
 * @param {Object} bot - Bot record
 * @param {Object} channel - Channel record
 * @param {Object} eventData - Event data from Slack
 * @returns {Object} Response object
 */
async function processBotMessage(bot, channel, eventData) {
  try {
    // Clean message text (remove bot mention)
    let text = eventData.text || '';
    text = text.replace(/<@[A-Z0-9]+>/g, '').trim();

    if (!text) {
      return null;
    }

    // Get bot's AI configuration
    const aiConfig = bot.ai_config ? JSON.parse(bot.ai_config) : {};
    const botSettings = bot.settings ? JSON.parse(bot.settings) : {};

    // Get or create conversation session
    let session = await db('slack_sessions')
      .where({
        channel_id: channel.id,
        slack_channel_id: eventData.channelId,
        user_id: eventData.userId
      })
      .first();

    if (!session) {
      // Create new session
      const [newSessionId] = await db('slack_sessions').insert({
        channel_id: channel.id,
        slack_channel_id: eventData.channelId,
        user_id: eventData.userId,
        thread_ts: eventData.threadTs,
        context: JSON.stringify([]),
        created_at: new Date(),
        updated_at: new Date()
      });
      session = await db('slack_sessions').where({ id: newSessionId }).first();
    }

    // Get conversation context
    let context = [];
    try {
      context = JSON.parse(session?.context || '[]');
    } catch (e) {
      context = [];
    }

    // Add user message to context
    context.push({
      role: 'user',
      content: text,
      timestamp: new Date().toISOString()
    });

    // Keep only last 10 messages for context
    if (context.length > 10) {
      context = context.slice(-10);
    }

    // Try to get AI response
    let aiResponse = null;

    try {
      // Check if RAG is enabled for this bot
      const knowledgeBase = await db('knowledge_bases')
        .where({ bot_id: bot.id, is_active: true })
        .first();

      if (knowledgeBase) {
        // Search knowledge base for relevant context
        const relevantDocs = await searchKnowledgeBase(bot.id, text);

        if (relevantDocs && relevantDocs.length > 0) {
          const ragContext = relevantDocs.map(doc => doc.content).join('\n\n');
          // Generate AI response with RAG context
          aiResponse = await generateAIResponse(bot, text, context, ragContext);
        }
      }

      // If no RAG or no relevant docs, use regular AI
      if (!aiResponse) {
        aiResponse = await generateAIResponse(bot, text, context, null);
      }
    } catch (aiError) {
      // AI error - use fallback
      aiResponse = {
        text: botSettings.fallbackMessage || 'I apologize, but I\'m having trouble processing your request. Please try again.',
        blocks: null
      };
    }

    // Add assistant response to context
    context.push({
      role: 'assistant',
      content: aiResponse.text,
      timestamp: new Date().toISOString()
    });

    // Update session context
    if (session?.id) {
      await db('slack_sessions')
        .where({ id: session.id })
        .update({
          context: JSON.stringify(context),
          updated_at: new Date()
        });
    }

    // Log analytics
    await logSlackAnalytics(channel.id, eventData, aiResponse);

    // Build Slack blocks for rich response
    const blocks = aiResponse.blocks || [
      slackService.buildTextBlock(aiResponse.text),
      slackService.buildDivider(),
      slackService.buildContextBlock([
        { text: `_Powered by ${bot.name}_` }
      ])
    ];

    return {
      text: aiResponse.text,
      blocks: blocks
    };

  } catch (error) {
    return {
      text: 'Sorry, I encountered an error processing your message. Please try again.'
    };
  }
}

/**
 * Search knowledge base for relevant documents
 * @param {number} botId - Bot ID
 * @param {string} query - Search query
 * @returns {Array} Relevant documents
 */
async function searchKnowledgeBase(botId, query) {
  try {
    // Get knowledge base documents
    const documents = await db('knowledge_documents')
      .where({ bot_id: botId, is_active: true })
      .select('id', 'title', 'content', 'metadata');

    if (!documents || documents.length === 0) {
      return [];
    }

    // Simple keyword-based search (can be replaced with vector search)
    const queryWords = query.toLowerCase().split(/\s+/);
    const scoredDocs = documents.map(doc => {
      const content = (doc.content || '').toLowerCase();
      const title = (doc.title || '').toLowerCase();

      let score = 0;
      queryWords.forEach(word => {
        if (word.length > 2) {
          if (content.includes(word)) score += 1;
          if (title.includes(word)) score += 2;
        }
      });

      return { ...doc, score };
    });

    // Return top 3 relevant documents
    return scoredDocs
      .filter(doc => doc.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

  } catch (error) {
    return [];
  }
}

/**
 * Generate AI response using bot's AI configuration
 * @param {Object} bot - Bot record
 * @param {string} userMessage - User's message
 * @param {Array} context - Conversation context
 * @param {string} ragContext - RAG context from knowledge base
 * @returns {Object} AI response
 */
async function generateAIResponse(bot, userMessage, context, ragContext) {
  const aiConfig = bot.ai_config ? JSON.parse(bot.ai_config) : {};
  const botSettings = bot.settings ? JSON.parse(bot.settings) : {};

  // Build system prompt
  let systemPrompt = aiConfig.systemPrompt || botSettings.systemPrompt ||
    `You are ${bot.name}, a helpful AI assistant. ${bot.description || ''}`;

  // Add RAG context if available
  if (ragContext) {
    systemPrompt += `\n\nUse the following information to help answer the user's question:\n${ragContext}`;
  }

  // Get AI provider config
  const aiProvider = aiConfig.provider || 'openai';
  const aiModel = aiConfig.model || 'gpt-3.5-turbo';

  try {
    // Check for API key in bot config or environment
    const apiKey = aiConfig.apiKey || process.env.OPENAI_API_KEY;

    if (!apiKey) {
      // No API key - return a helpful message
      return {
        text: `Thank you for your message! I'm ${bot.name}. I received: "${userMessage}"\n\nTo enable AI responses, please configure an API key in your bot settings.`,
        blocks: null
      };
    }

    // Make AI API call based on provider
    if (aiProvider === 'openai' || aiProvider === 'azure') {
      const response = await callOpenAI(apiKey, aiModel, systemPrompt, context, userMessage, aiConfig);
      return {
        text: response,
        blocks: null
      };
    } else if (aiProvider === 'anthropic' || aiProvider === 'claude') {
      const response = await callAnthropic(apiKey, aiModel, systemPrompt, context, userMessage, aiConfig);
      return {
        text: response,
        blocks: null
      };
    } else {
      // Fallback for unknown provider
      return {
        text: `Thank you for your message! I received: "${userMessage}"`,
        blocks: null
      };
    }
  } catch (error) {
    // Return fallback response on error
    return {
      text: botSettings.fallbackMessage || 'I apologize, but I\'m having trouble processing your request right now. Please try again later.',
      blocks: null
    };
  }
}

/**
 * Call OpenAI API
 * @param {string} apiKey - API key
 * @param {string} model - Model name
 * @param {string} systemPrompt - System prompt
 * @param {Array} context - Conversation context
 * @param {string} userMessage - User message
 * @param {Object} config - AI config
 * @returns {string} AI response text
 */
async function callOpenAI(apiKey, model, systemPrompt, context, userMessage, config) {
  const messages = [
    { role: 'system', content: systemPrompt },
    ...context.slice(-8).map(msg => ({
      role: msg.role,
      content: msg.content
    })),
    { role: 'user', content: userMessage }
  ];

  const response = await fetch(config.baseUrl || 'https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model,
      messages: messages,
      max_tokens: config.maxTokens || 1000,
      temperature: config.temperature || 0.7
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

/**
 * Call Anthropic API
 * @param {string} apiKey - API key
 * @param {string} model - Model name
 * @param {string} systemPrompt - System prompt
 * @param {Array} context - Conversation context
 * @param {string} userMessage - User message
 * @param {Object} config - AI config
 * @returns {string} AI response text
 */
async function callAnthropic(apiKey, model, systemPrompt, context, userMessage, config) {
  const messages = context.slice(-8).map(msg => ({
    role: msg.role,
    content: msg.content
  }));
  messages.push({ role: 'user', content: userMessage });

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: model || 'claude-3-haiku-20240307',
      max_tokens: config.maxTokens || 1000,
      system: systemPrompt,
      messages: messages
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

/**
 * Log Slack message analytics
 * @param {number} channelId - Channel ID
 * @param {Object} eventData - Event data
 * @param {Object} response - AI response
 */
async function logSlackAnalytics(channelId, eventData, response) {
  try {
    await db('slack_analytics').insert({
      channel_id: channelId,
      slack_channel_id: eventData.channelId,
      user_id: eventData.userId,
      message_type: eventData.type || 'message',
      message_length: (eventData.text || '').length,
      response_length: (response.text || '').length,
      thread_ts: eventData.threadTs,
      created_at: new Date()
    });
  } catch (error) {
    // Analytics logging error - silent fail
  }
}

module.exports = router;
