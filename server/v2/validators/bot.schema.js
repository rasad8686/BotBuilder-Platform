/**
 * Bot Validation Schemas
 */

const Joi = require('joi');

// Common ID pattern
const idPattern = Joi.string().pattern(/^[a-zA-Z0-9_-]+$/).max(50);

// Bot creation schema
const createBot = {
  body: Joi.object({
    name: Joi.string().min(1).max(100).required(),
    description: Joi.string().max(500).optional(),
    language: Joi.string().length(2).default('en'),
    aiProvider: Joi.string().valid('openai', 'anthropic', 'google').default('openai'),
    aiModel: Joi.string().max(50).optional(),
    systemPrompt: Joi.string().max(4000).optional(),
    temperature: Joi.number().min(0).max(2).default(0.7),
    maxTokens: Joi.number().integer().min(1).max(4096).default(500),
    isActive: Joi.boolean().default(true),
    settings: Joi.object().optional()
  })
};

// Bot update schema
const updateBot = {
  params: Joi.object({
    id: idPattern.required()
  }),
  body: Joi.object({
    name: Joi.string().min(1).max(100).optional(),
    description: Joi.string().max(500).optional(),
    language: Joi.string().length(2).optional(),
    aiProvider: Joi.string().valid('openai', 'anthropic', 'google').optional(),
    aiModel: Joi.string().max(50).optional(),
    systemPrompt: Joi.string().max(4000).optional(),
    temperature: Joi.number().min(0).max(2).optional(),
    maxTokens: Joi.number().integer().min(1).max(4096).optional(),
    isActive: Joi.boolean().optional(),
    settings: Joi.object().optional()
  }).min(1)
};

// Bot ID param schema
const botIdParam = {
  params: Joi.object({
    id: idPattern.required()
  })
};

// List bots query schema
const listBots = {
  query: Joi.object({
    limit: Joi.number().integer().min(1).max(100).default(20),
    cursor: Joi.string().optional(),
    offset: Joi.number().integer().min(0).default(0),
    status: Joi.string().valid('active', 'inactive', 'all').default('all'),
    sort: Joi.string().valid('created_at', '-created_at', 'name', '-name', 'updated_at', '-updated_at').default('-created_at'),
    search: Joi.string().max(100).optional()
  })
};

module.exports = {
  createBot,
  updateBot,
  botIdParam,
  listBots
};
