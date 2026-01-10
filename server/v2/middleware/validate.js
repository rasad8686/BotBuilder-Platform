/**
 * Validation Middleware
 * Uses Joi for schema validation
 */

const Joi = require('joi');
const { ErrorCodes, ApiError } = require('../constants/errorCodes');

/**
 * Create validation middleware
 * @param {Object} schema - Joi schema object with body, query, params
 */
function validate(schema) {
  return (req, res, next) => {
    const errors = [];

    // Validate body
    if (schema.body) {
      const { error, value } = schema.body.validate(req.body, { abortEarly: false });
      if (error) {
        errors.push(...error.details.map(d => ({
          field: d.path.join('.'),
          message: d.message,
          type: 'body'
        })));
      } else {
        req.body = value;
      }
    }

    // Validate query
    if (schema.query) {
      const { error, value } = schema.query.validate(req.query, { abortEarly: false });
      if (error) {
        errors.push(...error.details.map(d => ({
          field: d.path.join('.'),
          message: d.message,
          type: 'query'
        })));
      } else {
        req.query = value;
      }
    }

    // Validate params
    if (schema.params) {
      const { error, value } = schema.params.validate(req.params, { abortEarly: false });
      if (error) {
        errors.push(...error.details.map(d => ({
          field: d.path.join('.'),
          message: d.message,
          type: 'params'
        })));
      } else {
        req.params = value;
      }
    }

    if (errors.length > 0) {
      return res.apiError(ErrorCodes.VALIDATION_ERROR, { errors });
    }

    next();
  };
}

module.exports = validate;
