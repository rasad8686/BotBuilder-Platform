/**
 * ToolPlugin - Base class for Agent tool plugins
 * Provides tools that AI agents can use during execution
 */

const BasePlugin = require('./BasePlugin');
const log = require('../../utils/logger');

class ToolPlugin extends BasePlugin {
  constructor(config = {}) {
    super(config);
    this.toolName = config.toolName || this.id;
    this.toolDescription = config.toolDescription || '';
    this.parameters = config.parameters || {};
    this.requiredParams = config.requiredParams || [];
    this.timeout = config.timeout || 30000;
    this.rateLimitPerMinute = config.rateLimitPerMinute || 60;
    this.callCount = 0;
    this.lastResetTime = Date.now();
  }

  /**
   * Get plugin type
   * @returns {string}
   */
  getType() {
    return 'tool';
  }

  /**
   * Execute the tool
   * @param {object} params - Tool parameters
   * @param {object} context - Execution context
   * @returns {Promise<object>}
   */
  async execute(params, context = {}) {
    if (!this.isEnabled()) {
      throw new Error('Tool is not enabled');
    }

    // Rate limiting
    if (!this.checkRateLimit()) {
      throw new Error('Rate limit exceeded');
    }

    // Validate parameters
    const validationResult = await this.validate(params);
    if (!validationResult.valid) {
      return {
        success: false,
        error: validationResult.error,
        errors: validationResult.errors
      };
    }

    const startTime = Date.now();

    try {
      // Execute with timeout
      const result = await this.executeWithTimeout(
        this.doExecute(params, context),
        this.timeout
      );

      this.callCount++;

      return {
        success: true,
        data: result.data,
        output: result.output || result.data,
        metadata: {
          tool: this.toolName,
          duration: Date.now() - startTime,
          ...result.metadata
        }
      };
    } catch (error) {
      log.error(`[${this.toolName}] Execution error:`, error.message);

      return {
        success: false,
        error: error.message,
        metadata: {
          tool: this.toolName,
          duration: Date.now() - startTime
        }
      };
    }
  }

  /**
   * Validate input parameters
   * @param {object} params - Parameters to validate
   * @returns {Promise<object>}
   */
  async validate(params) {
    const errors = [];

    // Check required parameters
    for (const required of this.requiredParams) {
      if (params[required] === undefined || params[required] === null) {
        errors.push({
          field: required,
          message: `${required} is required`
        });
      }
    }

    // Validate parameter types
    for (const [key, schema] of Object.entries(this.parameters)) {
      if (params[key] !== undefined) {
        const typeError = this.validateType(params[key], schema);
        if (typeError) {
          errors.push({
            field: key,
            message: typeError
          });
        }
      }
    }

    // Custom validation
    const customErrors = await this.customValidate(params);
    errors.push(...customErrors);

    return {
      valid: errors.length === 0,
      errors,
      error: errors.length > 0 ? errors.map(e => e.message).join('; ') : null
    };
  }

  /**
   * Get JSON schema for the tool (OpenAI function calling format)
   * @returns {object}
   */
  getSchema() {
    const properties = {};
    const required = [];

    for (const [key, schema] of Object.entries(this.parameters)) {
      properties[key] = {
        type: schema.type || 'string',
        description: schema.description || ''
      };

      if (schema.enum) {
        properties[key].enum = schema.enum;
      }

      if (schema.default !== undefined) {
        properties[key].default = schema.default;
      }

      if (schema.required || this.requiredParams.includes(key)) {
        required.push(key);
      }
    }

    return {
      type: 'function',
      function: {
        name: this.toolName,
        description: this.toolDescription || this.description,
        parameters: {
          type: 'object',
          properties,
          required
        }
      }
    };
  }

  /**
   * Validate a single parameter type
   * @param {any} value
   * @param {object} schema
   * @returns {string|null}
   */
  validateType(value, schema) {
    const expectedType = schema.type || 'string';

    switch (expectedType) {
      case 'string':
        if (typeof value !== 'string') return `Expected string, got ${typeof value}`;
        if (schema.minLength && value.length < schema.minLength) {
          return `Minimum length is ${schema.minLength}`;
        }
        if (schema.maxLength && value.length > schema.maxLength) {
          return `Maximum length is ${schema.maxLength}`;
        }
        if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
          return `Value does not match pattern`;
        }
        break;

      case 'number':
      case 'integer':
        if (typeof value !== 'number') return `Expected number, got ${typeof value}`;
        if (schema.minimum !== undefined && value < schema.minimum) {
          return `Minimum value is ${schema.minimum}`;
        }
        if (schema.maximum !== undefined && value > schema.maximum) {
          return `Maximum value is ${schema.maximum}`;
        }
        break;

      case 'boolean':
        if (typeof value !== 'boolean') return `Expected boolean, got ${typeof value}`;
        break;

      case 'array':
        if (!Array.isArray(value)) return `Expected array, got ${typeof value}`;
        if (schema.minItems && value.length < schema.minItems) {
          return `Minimum items is ${schema.minItems}`;
        }
        if (schema.maxItems && value.length > schema.maxItems) {
          return `Maximum items is ${schema.maxItems}`;
        }
        break;

      case 'object':
        if (typeof value !== 'object' || Array.isArray(value)) {
          return `Expected object, got ${typeof value}`;
        }
        break;
    }

    if (schema.enum && !schema.enum.includes(value)) {
      return `Value must be one of: ${schema.enum.join(', ')}`;
    }

    return null;
  }

  /**
   * Custom validation (override in subclass)
   * @param {object} params
   * @returns {Promise<Array>}
   */
  async customValidate(params) {
    return [];
  }

  /**
   * Execute with timeout
   * @param {Promise} promise
   * @param {number} timeout
   * @returns {Promise}
   */
  async executeWithTimeout(promise, timeout) {
    return Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Execution timed out')), timeout)
      )
    ]);
  }

  /**
   * Check rate limit
   * @returns {boolean}
   */
  checkRateLimit() {
    const now = Date.now();
    if (now - this.lastResetTime >= 60000) {
      this.callCount = 0;
      this.lastResetTime = now;
    }
    return this.callCount < this.rateLimitPerMinute;
  }

  /**
   * Actually execute the tool (implement in subclass)
   * @param {object} params
   * @param {object} context
   * @returns {Promise<object>}
   */
  async doExecute(params, context) {
    throw new Error('doExecute must be implemented in subclass');
  }

  /**
   * Get tool info for agent
   * @returns {object}
   */
  getToolInfo() {
    return {
      name: this.toolName,
      description: this.toolDescription || this.description,
      parameters: this.parameters,
      requiredParams: this.requiredParams,
      schema: this.getSchema()
    };
  }

  /**
   * Get settings schema
   * @returns {object}
   */
  getSettingsSchema() {
    return {
      timeout: {
        type: 'number',
        label: 'Timeout (ms)',
        default: 30000,
        min: 1000,
        max: 300000
      },
      rateLimitPerMinute: {
        type: 'number',
        label: 'Rate Limit (per minute)',
        default: 60,
        min: 1,
        max: 1000
      }
    };
  }
}

module.exports = ToolPlugin;
