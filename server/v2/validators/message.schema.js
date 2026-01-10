/**
 * Message Validation Schemas
 */

const Joi = require('joi');

// Send message schema
const sendMessage = {
  params: Joi.object({
    botId: Joi.string().required()
  }),
  body: Joi.object({
    content: Joi.string().min(1).max(10000).required(),
    conversationId: Joi.string().optional(),
    metadata: Joi.object().optional(),
    stream: Joi.boolean().default(false)
  })
};

// List messages query schema
const listMessages = {
  params: Joi.object({
    botId: Joi.string().required()
  }),
  query: Joi.object({
    limit: Joi.number().integer().min(1).max(100).default(50),
    cursor: Joi.string().optional(),
    conversationId: Joi.string().optional(),
    role: Joi.string().valid('user', 'assistant', 'system').optional(),
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().optional(),
    sort: Joi.string().valid('created_at', '-created_at').default('-created_at')
  })
};

// Get message schema
const getMessage = {
  params: Joi.object({
    botId: Joi.string().required(),
    messageId: Joi.string().required()
  })
};

module.exports = {
  sendMessage,
  listMessages,
  getMessage
};
