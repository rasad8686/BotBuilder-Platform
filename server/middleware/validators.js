const Joi = require('joi');

// Validation schemas
const schemas = {
  // User registration validation
  register: Joi.object({
    username: Joi.string().min(3).max(30).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
  }),

  // User login validation
  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
  }),

  // Bot creation validation
  createBot: Joi.object({
    name: Joi.string().min(1).max(100).required(),
    platform: Joi.string().valid('telegram', 'discord', 'slack', 'whatsapp').required(),
    description: Joi.string().max(500).optional(),
  }),

  // Message validation
  createMessage: Joi.object({
    bot_id: Joi.number().integer().required(),
    message_type: Joi.string().valid('response', 'command', 'error').required(),
    content: Joi.string().min(1).required(),
  }),
};

// Validation middleware factory
const validate = (schemaName) => {
  return (req, res, next) => {
    const schema = schemas[schemaName];
    if (!schema) {
      return next();
    }

    const { error } = schema.validate(req.body, { abortEarly: false });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }

    next();
  };
};

module.exports = { validate, schemas };
