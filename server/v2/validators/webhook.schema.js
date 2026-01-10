/**
 * Webhook Validation Schemas
 */

const Joi = require('joi');

// Create webhook schema
const createWebhook = {
  body: Joi.object({
    url: Joi.string().uri({ scheme: ['http', 'https'] }).required(),
    events: Joi.array().items(
      Joi.string().valid(
        'bot.created',
        'bot.updated',
        'bot.deleted',
        'message.received',
        'message.sent',
        'conversation.started',
        'conversation.ended',
        'agent.task.started',
        'agent.task.completed',
        'agent.task.failed'
      )
    ).min(1).required(),
    description: Joi.string().max(255).optional(),
    isActive: Joi.boolean().default(true),
    secret: Joi.string().min(16).max(64).optional(),
    headers: Joi.object().pattern(
      Joi.string(),
      Joi.string()
    ).optional()
  })
};

// Update webhook schema
const updateWebhook = {
  params: Joi.object({
    id: Joi.string().required()
  }),
  body: Joi.object({
    url: Joi.string().uri({ scheme: ['http', 'https'] }).optional(),
    events: Joi.array().items(Joi.string()).min(1).optional(),
    description: Joi.string().max(255).optional(),
    isActive: Joi.boolean().optional(),
    headers: Joi.object().pattern(
      Joi.string(),
      Joi.string()
    ).optional()
  }).min(1)
};

// Webhook ID param schema
const webhookIdParam = {
  params: Joi.object({
    id: Joi.string().required()
  })
};

// List webhooks query
const listWebhooks = {
  query: Joi.object({
    limit: Joi.number().integer().min(1).max(100).default(20),
    cursor: Joi.string().optional(),
    isActive: Joi.boolean().optional(),
    event: Joi.string().optional()
  })
};

module.exports = {
  createWebhook,
  updateWebhook,
  webhookIdParam,
  listWebhooks
};
