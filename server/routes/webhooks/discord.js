/**
 * Discord Webhook Routes
 * Handles incoming events from Discord Gateway and Interactions
 * Full-featured with AI/RAG support, slash commands, threads, and analytics
 */

const express = require('express');
const router = express.Router();
const discordService = require('../../services/channels/discordService');
const db = require('../../db');
const nacl = require('tweetnacl');

// Rate limiting tracker
const rateLimitTracker = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 30;

// Session/context storage
const conversationContexts = new Map();
const CONTEXT_EXPIRY = 30 * 60 * 1000; // 30 minutes

/**
 * POST /api/webhooks/discord/:botId/interactions
 * Discord Interactions endpoint - receives slash commands, buttons, select menus
 */
router.post('/:botId/interactions', async (req, res) => {
  const { botId } = req.params;
  const signature = req.headers['x-signature-ed25519'];
  const timestamp = req.headers['x-signature-timestamp'];

  try {
    // Find discord channel by botId
    const channel = await db('discord_channels')
      .where({ bot_id: botId, is_active: true })
      .first();

    if (!channel) {
      return res.status(404).json({ error: 'Bot not found' });
    }

    // Verify Discord signature
    if (channel.public_key) {
      const isValid = verifyDiscordSignature(
        req.rawBody || JSON.stringify(req.body),
        signature,
        timestamp,
        channel.public_key
      );

      if (!isValid) {
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    const interaction = req.body;

    // Handle PING (Discord verification)
    if (interaction.type === 1) {
      return res.json({ type: 1 });
    }

    // Handle Application Commands (Slash Commands)
    if (interaction.type === 2) {
      const response = await handleSlashCommand(channel, interaction);
      return res.json(response);
    }

    // Handle Message Components (Buttons, Select Menus)
    if (interaction.type === 3) {
      const response = await handleComponentInteraction(channel, interaction);
      return res.json(response);
    }

    // Handle Autocomplete
    if (interaction.type === 4) {
      const response = await handleAutocomplete(channel, interaction);
      return res.json(response);
    }

    // Handle Modal Submit
    if (interaction.type === 5) {
      const response = await handleModalSubmit(channel, interaction);
      return res.json(response);
    }

    res.json({ type: 1 });

  } catch (error) {
    console.error('Discord Interaction Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/webhooks/discord/:botId/gateway
 * Discord Gateway webhook - receives messages and events via gateway proxy
 */
router.post('/:botId/gateway', async (req, res) => {
  const { botId } = req.params;

  try {
    const channel = await db('discord_channels')
      .where({ bot_id: botId, is_active: true })
      .first();

    if (!channel) {
      return res.status(404).json({ error: 'Bot not found' });
    }

    const event = req.body;

    // Store event for processing
    await db('discord_messages').insert({
      channel_id: channel.id,
      event_type: event.t || 'UNKNOWN',
      guild_id: event.d?.guild_id,
      discord_channel_id: event.d?.channel_id,
      user_id: event.d?.author?.id,
      username: event.d?.author?.username,
      message_content: event.d?.content,
      message_id: event.d?.id,
      raw_data: JSON.stringify(event),
      created_at: new Date()
    });

    // Route event based on type
    if (event.t === 'MESSAGE_CREATE') {
      await handleMessageCreate(channel, event.d);
    } else if (event.t === 'MESSAGE_REACTION_ADD') {
      await handleReactionAdd(channel, event.d);
    } else if (event.t === 'THREAD_CREATE') {
      await handleThreadCreate(channel, event.d);
    }

    res.status(200).json({ ok: true });

  } catch (error) {
    console.error('Discord Gateway Error:', error);
    res.status(200).json({ ok: true, error: 'Processing error' });
  }
});

/**
 * Verify Discord interaction signature
 */
function verifyDiscordSignature(body, signature, timestamp, publicKey) {
  try {
    const message = Buffer.from(timestamp + body);
    const sig = Buffer.from(signature, 'hex');
    const key = Buffer.from(publicKey, 'hex');

    return nacl.sign.detached.verify(message, sig, key);
  } catch (error) {
    return false;
  }
}

/**
 * Check rate limit for a user
 */
function isRateLimited(userId) {
  const now = Date.now();
  const key = userId.toString();

  if (!rateLimitTracker.has(key)) {
    rateLimitTracker.set(key, { count: 1, windowStart: now });
    return false;
  }

  const tracker = rateLimitTracker.get(key);

  if (now - tracker.windowStart > RATE_LIMIT_WINDOW) {
    tracker.count = 1;
    tracker.windowStart = now;
    return false;
  }

  if (tracker.count >= MAX_REQUESTS_PER_WINDOW) {
    return true;
  }

  tracker.count++;
  return false;
}

/**
 * Handle Slash Command interactions
 */
async function handleSlashCommand(channel, interaction) {
  const commandName = interaction.data.name;
  const userId = interaction.member?.user?.id || interaction.user?.id;
  const username = interaction.member?.user?.username || interaction.user?.username;

  // Check rate limit
  if (isRateLimited(userId)) {
    return createInteractionResponse(4, {
      content: 'You are sending commands too quickly. Please wait a moment.',
      flags: 64 // Ephemeral
    });
  }

  // Get associated bot
  const bot = await db('bots')
    .where({ id: channel.bot_id })
    .first();

  if (!bot || bot.status !== 'active') {
    return createInteractionResponse(4, {
      content: 'Bot is currently unavailable.',
      flags: 64
    });
  }

  // Log command usage
  await logCommandAnalytics(channel.id, commandName, userId, username);

  // Handle built-in commands
  switch (commandName) {
    case 'help':
      return handleHelpCommand(bot, channel);

    case 'ask':
      return await handleAskCommand(bot, channel, interaction);

    case 'status':
      return handleStatusCommand(bot, channel);

    case 'clear':
      return handleClearCommand(userId);

    case 'info':
      return handleInfoCommand(bot, channel);

    default:
      // Check for custom commands
      return await handleCustomCommand(bot, channel, interaction, commandName);
  }
}

/**
 * Handle /help command
 */
function handleHelpCommand(bot, channel) {
  const embed = {
    title: `Help - ${bot.name}`,
    description: bot.description || 'Your AI assistant',
    color: 0x7289DA,
    fields: [
      {
        name: 'Available Commands',
        value: [
          '`/help` - Show this help message',
          '`/ask <question>` - Ask the AI a question',
          '`/status` - Check bot status',
          '`/clear` - Clear your conversation history',
          '`/info` - Bot information'
        ].join('\n'),
        inline: false
      },
      {
        name: 'Tips',
        value: 'You can also mention me or send a direct message to chat naturally!',
        inline: false
      }
    ],
    footer: {
      text: 'Powered by BotBuilder Platform'
    },
    timestamp: new Date().toISOString()
  };

  return createInteractionResponse(4, {
    embeds: [embed]
  });
}

/**
 * Handle /ask command - AI/RAG response
 */
async function handleAskCommand(bot, channel, interaction) {
  const question = interaction.data.options?.find(o => o.name === 'question')?.value;

  if (!question) {
    return createInteractionResponse(4, {
      content: 'Please provide a question.',
      flags: 64
    });
  }

  const userId = interaction.member?.user?.id || interaction.user?.id;
  const username = interaction.member?.user?.username || interaction.user?.username;

  try {
    // Defer response for AI processing
    // Note: In actual implementation, we'd use deferred response
    // For webhook, we need to respond quickly

    // Get AI response with RAG
    const aiResponse = await processAIMessage(bot, {
      userId,
      username,
      content: question,
      channelId: interaction.channel_id
    }, channel);

    const responseEmbed = {
      title: 'AI Response',
      description: aiResponse.text,
      color: 0x00FF00,
      fields: [
        {
          name: 'Question',
          value: question.substring(0, 1024),
          inline: false
        }
      ],
      footer: {
        text: `Asked by ${username} | Powered by ${bot.name}`
      },
      timestamp: new Date().toISOString()
    };

    // Add source information if RAG was used
    if (aiResponse.sources && aiResponse.sources.length > 0) {
      responseEmbed.fields.push({
        name: 'Sources',
        value: aiResponse.sources.slice(0, 3).map(s => `- ${s.title}`).join('\n'),
        inline: false
      });
    }

    return createInteractionResponse(4, {
      embeds: [responseEmbed]
    });

  } catch (error) {
    return createInteractionResponse(4, {
      content: 'Sorry, I encountered an error processing your question. Please try again.',
      flags: 64
    });
  }
}

/**
 * Handle /status command
 */
function handleStatusCommand(bot, channel) {
  const embed = {
    title: 'Bot Status',
    color: 0x00FF00,
    fields: [
      { name: 'Status', value: 'Online', inline: true },
      { name: 'Bot Name', value: bot.name, inline: true },
      { name: 'Version', value: '1.0.0', inline: true },
      { name: 'AI Enabled', value: bot.ai_config ? 'Yes' : 'No', inline: true }
    ],
    footer: {
      text: 'BotBuilder Platform'
    },
    timestamp: new Date().toISOString()
  };

  return createInteractionResponse(4, {
    embeds: [embed]
  });
}

/**
 * Handle /clear command
 */
function handleClearCommand(userId) {
  // Clear user's conversation context
  conversationContexts.delete(userId);

  return createInteractionResponse(4, {
    content: 'Your conversation history has been cleared.',
    flags: 64
  });
}

/**
 * Handle /info command
 */
function handleInfoCommand(bot, channel) {
  const embed = {
    title: `About ${bot.name}`,
    description: bot.description || 'A powerful AI assistant',
    color: 0x7289DA,
    fields: [
      { name: 'Created', value: new Date(bot.created_at).toLocaleDateString(), inline: true },
      { name: 'Platform', value: 'BotBuilder', inline: true }
    ],
    footer: {
      text: 'Powered by BotBuilder Platform'
    },
    timestamp: new Date().toISOString()
  };

  return createInteractionResponse(4, {
    embeds: [embed]
  });
}

/**
 * Handle custom slash commands
 */
async function handleCustomCommand(bot, channel, interaction, commandName) {
  const botSettings = bot.settings ? JSON.parse(bot.settings) : {};
  const customCommands = botSettings.customCommands || {};

  if (customCommands[commandName]) {
    const cmd = customCommands[commandName];
    return createInteractionResponse(4, {
      content: cmd.response,
      embeds: cmd.embed ? [cmd.embed] : undefined
    });
  }

  return createInteractionResponse(4, {
    content: `Unknown command: /${commandName}`,
    flags: 64
  });
}

/**
 * Handle Component Interactions (Buttons, Select Menus)
 */
async function handleComponentInteraction(channel, interaction) {
  const customId = interaction.data.custom_id;
  const componentType = interaction.data.component_type;
  const userId = interaction.member?.user?.id || interaction.user?.id;

  // Get associated bot
  const bot = await db('bots')
    .where({ id: channel.bot_id })
    .first();

  if (!bot) {
    return createInteractionResponse(4, {
      content: 'Bot is currently unavailable.',
      flags: 64
    });
  }

  // Handle button clicks
  if (componentType === 2) {
    return await handleButtonClick(bot, channel, interaction, customId);
  }

  // Handle select menu
  if (componentType === 3) {
    const selectedValues = interaction.data.values;
    return await handleSelectMenu(bot, channel, interaction, customId, selectedValues);
  }

  return createInteractionResponse(4, {
    content: 'Interaction processed.',
    flags: 64
  });
}

/**
 * Handle button click
 */
async function handleButtonClick(bot, channel, interaction, customId) {
  const botSettings = bot.settings ? JSON.parse(bot.settings) : {};
  const buttonActions = botSettings.buttonActions || {};

  // Check for predefined button actions
  if (buttonActions[customId]) {
    const action = buttonActions[customId];

    if (action.type === 'reply') {
      return createInteractionResponse(4, {
        content: action.content,
        embeds: action.embed ? [action.embed] : undefined
      });
    }

    if (action.type === 'create_thread') {
      // Create a thread for this interaction
      return createInteractionResponse(4, {
        content: 'Creating a thread for your request...',
        flags: 64
      });
    }
  }

  // Handle action: prefixed buttons
  if (customId.startsWith('action:')) {
    const action = customId.replace('action:', '');
    return await processActionButton(bot, channel, interaction, action);
  }

  // Handle ai: prefixed buttons (send to AI)
  if (customId.startsWith('ai:')) {
    const query = customId.replace('ai:', '');
    const userId = interaction.member?.user?.id || interaction.user?.id;

    const aiResponse = await processAIMessage(bot, {
      userId,
      content: query,
      channelId: interaction.channel_id
    }, channel);

    return createInteractionResponse(4, {
      content: aiResponse.text
    });
  }

  // Default: acknowledge button
  return createInteractionResponse(6); // Deferred update
}

/**
 * Handle select menu selection
 */
async function handleSelectMenu(bot, channel, interaction, customId, values) {
  const botSettings = bot.settings ? JSON.parse(bot.settings) : {};
  const selectActions = botSettings.selectActions || {};

  if (selectActions[customId]) {
    const action = selectActions[customId];
    const selectedValue = values[0];

    if (action.options && action.options[selectedValue]) {
      const response = action.options[selectedValue];
      return createInteractionResponse(4, {
        content: response.content,
        embeds: response.embed ? [response.embed] : undefined
      });
    }
  }

  return createInteractionResponse(4, {
    content: `Selected: ${values.join(', ')}`,
    flags: 64
  });
}

/**
 * Process action button
 */
async function processActionButton(bot, channel, interaction, action) {
  switch (action) {
    case 'feedback_positive':
      return createInteractionResponse(4, {
        content: 'Thank you for your positive feedback!',
        flags: 64
      });

    case 'feedback_negative':
      return createInteractionResponse(4, {
        content: 'Thank you for your feedback. We will work to improve.',
        flags: 64
      });

    case 'more_info':
      return createInteractionResponse(4, {
        content: 'Here is more information about this topic...',
        embeds: [{ title: 'More Information', description: 'Additional details here.', color: 0x7289DA }]
      });

    default:
      return createInteractionResponse(4, {
        content: `Action: ${action} processed.`,
        flags: 64
      });
  }
}

/**
 * Handle autocomplete interactions
 */
async function handleAutocomplete(channel, interaction) {
  const focused = interaction.data.options?.find(o => o.focused);

  if (!focused) {
    return { type: 8, data: { choices: [] } };
  }

  // Get bot for custom autocomplete
  const bot = await db('bots')
    .where({ id: channel.bot_id })
    .first();

  // Search knowledge base for suggestions
  const suggestions = await searchKnowledgeBase(bot.id, focused.value, 5);

  const choices = suggestions.map(s => ({
    name: s.title.substring(0, 100),
    value: s.title.substring(0, 100)
  }));

  return { type: 8, data: { choices } };
}

/**
 * Handle modal submit
 */
async function handleModalSubmit(channel, interaction) {
  const customId = interaction.data.custom_id;
  const components = interaction.data.components;

  // Extract modal values
  const values = {};
  components.forEach(row => {
    row.components.forEach(comp => {
      values[comp.custom_id] = comp.value;
    });
  });

  // Process based on modal type
  if (customId.startsWith('feedback_modal:')) {
    return createInteractionResponse(4, {
      content: 'Thank you for your feedback!',
      flags: 64
    });
  }

  return createInteractionResponse(4, {
    content: 'Form submitted successfully.',
    flags: 64
  });
}

/**
 * Handle MESSAGE_CREATE event
 */
async function handleMessageCreate(channel, message) {
  // Ignore bot messages
  if (message.author?.bot) return;

  const userId = message.author?.id;
  const content = message.content;
  const channelId = message.channel_id;
  const guildId = message.guild_id;

  // Check if bot is mentioned or in DM
  const botMentioned = message.mentions?.some(m => m.id === channel.client_id);
  const isDM = !guildId;

  if (!botMentioned && !isDM) {
    return; // Only respond to mentions or DMs
  }

  // Get associated bot
  const bot = await db('bots')
    .where({ id: channel.bot_id })
    .first();

  if (!bot || bot.status !== 'active') return;

  // Check rate limit
  if (isRateLimited(userId)) {
    await sendRateLimitMessage(channel, channelId);
    return;
  }

  try {
    // Send typing indicator
    await discordService.sendTyping(channel.bot_token, channelId);

    // Clean content (remove mentions)
    const cleanContent = content.replace(/<@!?\d+>/g, '').trim();

    if (!cleanContent) {
      await discordService.sendMessage(
        channel.bot_token,
        channelId,
        'How can I help you? Just ask me a question!'
      );
      return;
    }

    // Process through AI/RAG
    const aiResponse = await processAIMessage(bot, {
      userId,
      username: message.author.username,
      content: cleanContent,
      channelId,
      messageId: message.id
    }, channel);

    // Build response with optional components
    const responseOptions = {};

    if (aiResponse.embed) {
      responseOptions.embeds = [aiResponse.embed];
    }

    if (aiResponse.buttons) {
      responseOptions.components = [
        discordService.buildButtonRow(aiResponse.buttons)
      ];
    }

    // Send response
    await discordService.sendMessage(
      channel.bot_token,
      channelId,
      aiResponse.text,
      {
        ...responseOptions,
        replyTo: message.id
      }
    );

    // Log analytics
    await logMessageAnalytics(channel.id, message, aiResponse);

  } catch (error) {
    console.error('Discord message handling error:', error);
    await discordService.sendMessage(
      channel.bot_token,
      channelId,
      'Sorry, I encountered an error processing your message. Please try again.'
    );
  }
}

/**
 * Handle reaction add event
 */
async function handleReactionAdd(channel, data) {
  // Can be used for feedback collection, etc.
  const emoji = data.emoji?.name;
  const messageId = data.message_id;
  const userId = data.user_id;

  // Log reaction for analytics
  await db('discord_reactions').insert({
    channel_id: channel.id,
    message_id: messageId,
    user_id: userId,
    emoji: emoji,
    created_at: new Date()
  }).catch(() => {}); // Silent fail
}

/**
 * Handle thread create event
 */
async function handleThreadCreate(channel, data) {
  const threadId = data.id;
  const threadName = data.name;
  const parentId = data.parent_id;

  // Log thread creation
  await db('discord_threads').insert({
    channel_id: channel.id,
    thread_id: threadId,
    thread_name: threadName,
    parent_channel_id: parentId,
    created_at: new Date()
  }).catch(() => {}); // Silent fail
}

/**
 * Process message through AI with RAG support
 */
async function processAIMessage(bot, messageData, channel) {
  try {
    const aiConfig = bot.ai_config ? JSON.parse(bot.ai_config) : {};
    const botSettings = bot.settings ? JSON.parse(bot.settings) : {};

    // Get or create conversation context
    const contextKey = `${channel.id}:${messageData.userId}`;
    let context = conversationContexts.get(contextKey) || [];

    // Clean expired contexts periodically
    cleanExpiredContexts();

    // Add user message to context
    context.push({
      role: 'user',
      content: messageData.content,
      timestamp: Date.now()
    });

    // Keep only last 10 messages
    if (context.length > 10) {
      context = context.slice(-10);
    }

    let aiResponse = null;
    let sources = [];

    try {
      // Check if RAG is enabled
      const knowledgeBase = await db('knowledge_bases')
        .where({ bot_id: bot.id, is_active: true })
        .first();

      if (knowledgeBase) {
        // Search knowledge base for relevant context
        const relevantDocs = await searchKnowledgeBase(bot.id, messageData.content);

        if (relevantDocs && relevantDocs.length > 0) {
          const ragContext = relevantDocs.map(doc => doc.content).join('\n\n');
          sources = relevantDocs.map(doc => ({ title: doc.title, id: doc.id }));

          aiResponse = await generateAIResponse(bot, messageData.content, context, ragContext);
        }
      }

      // If no RAG or no relevant docs, use regular AI
      if (!aiResponse) {
        aiResponse = await generateAIResponse(bot, messageData.content, context, null);
      }

    } catch (aiError) {
      console.error('AI Error:', aiError);
      aiResponse = {
        text: botSettings.fallbackMessage || 'I apologize, but I\'m having trouble processing your request. Please try again.',
        sources: []
      };
    }

    // Add assistant response to context
    context.push({
      role: 'assistant',
      content: aiResponse.text,
      timestamp: Date.now()
    });

    // Save updated context
    conversationContexts.set(contextKey, context);

    return {
      text: aiResponse.text,
      sources,
      buttons: aiResponse.buttons,
      embed: aiResponse.embed
    };

  } catch (error) {
    console.error('Process AI Message Error:', error);
    return {
      text: 'An error occurred processing your message. Please try again.',
      sources: []
    };
  }
}

/**
 * Search knowledge base for relevant documents
 */
async function searchKnowledgeBase(botId, query, limit = 3) {
  try {
    const documents = await db('knowledge_documents')
      .where({ bot_id: botId, is_active: true })
      .select('id', 'title', 'content', 'metadata');

    if (!documents || documents.length === 0) {
      return [];
    }

    // Simple keyword-based search
    const queryWords = query.toLowerCase().split(/\s+/);
    const scoredDocs = documents.map(doc => {
      const content = (doc.content || '').toLowerCase();
      const title = (doc.title || '').toLowerCase();

      let score = 0;
      queryWords.forEach(word => {
        if (word.length < 3) return; // Skip short words
        if (content.includes(word)) score += 1;
        if (title.includes(word)) score += 2;
      });

      return { ...doc, score };
    });

    return scoredDocs
      .filter(doc => doc.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

  } catch (error) {
    return [];
  }
}

/**
 * Generate AI response using bot's AI configuration
 */
async function generateAIResponse(bot, userMessage, context, ragContext) {
  const aiConfig = bot.ai_config ? JSON.parse(bot.ai_config) : {};
  const botSettings = bot.settings ? JSON.parse(bot.settings) : {};

  // Build system prompt
  let systemPrompt = aiConfig.systemPrompt || botSettings.systemPrompt ||
    `You are ${bot.name}, a helpful AI assistant on Discord. ${bot.description || ''}
Keep responses concise and Discord-friendly. Use markdown formatting when appropriate.`;

  // Add RAG context if available
  if (ragContext) {
    systemPrompt += `\n\nUse the following information to help answer the user's question:\n${ragContext}`;
  }

  const aiProvider = aiConfig.provider || 'openai';
  const aiModel = aiConfig.model || 'gpt-3.5-turbo';

  try {
    const apiKey = aiConfig.apiKey || process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return {
        text: `Thank you for your message! I'm ${bot.name}. I received: "${userMessage}"\n\nTo enable AI responses, please configure an API key in your bot settings.`,
        buttons: null
      };
    }

    if (aiProvider === 'openai' || aiProvider === 'azure') {
      const response = await callOpenAI(apiKey, aiModel, systemPrompt, context, userMessage, aiConfig);
      return { text: response, buttons: null };
    } else if (aiProvider === 'anthropic') {
      const response = await callAnthropic(apiKey, aiModel, systemPrompt, context, userMessage, aiConfig);
      return { text: response, buttons: null };
    } else {
      return {
        text: `Thank you for your message! I received: "${userMessage}"`,
        buttons: null
      };
    }
  } catch (error) {
    return {
      text: botSettings.fallbackMessage || 'I apologize, but I\'m having trouble processing your request right now. Please try again later.',
      buttons: null
    };
  }
}

/**
 * Call OpenAI API
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
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

/**
 * Call Anthropic API
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
    throw new Error(`Anthropic API error: ${response.status}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

/**
 * Create Discord interaction response
 */
function createInteractionResponse(type, data = {}) {
  return {
    type,
    data: type === 1 || type === 6 ? undefined : data
  };
}

/**
 * Send rate limit message
 */
async function sendRateLimitMessage(channel, channelId) {
  try {
    await discordService.sendMessage(
      channel.bot_token,
      channelId,
      'You are sending messages too quickly. Please wait a moment.'
    );
  } catch (error) {
    // Silent fail
  }
}

/**
 * Clean expired conversation contexts
 */
function cleanExpiredContexts() {
  const now = Date.now();
  for (const [key, context] of conversationContexts.entries()) {
    if (context.length > 0) {
      const lastMessage = context[context.length - 1];
      if (now - lastMessage.timestamp > CONTEXT_EXPIRY) {
        conversationContexts.delete(key);
      }
    }
  }
}

/**
 * Log message analytics
 */
async function logMessageAnalytics(channelId, message, response) {
  try {
    await db('discord_analytics').insert({
      channel_id: channelId,
      guild_id: message.guild_id,
      user_id: message.author?.id,
      message_type: 'text',
      message_length: (message.content || '').length,
      response_length: (response.text || '').length,
      has_sources: response.sources?.length > 0,
      source_count: response.sources?.length || 0,
      created_at: new Date()
    });
  } catch (error) {
    // Silent fail
  }
}

/**
 * Log command analytics
 */
async function logCommandAnalytics(channelId, commandName, userId, username) {
  try {
    await db('discord_command_analytics').insert({
      channel_id: channelId,
      command_name: commandName,
      user_id: userId,
      username: username,
      created_at: new Date()
    });
  } catch (error) {
    // Silent fail
  }
}

module.exports = router;
