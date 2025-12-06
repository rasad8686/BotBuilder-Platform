/**
 * ToolCallParser - Parses tool calls from various formats
 * Supports OpenAI, Anthropic, and custom format
 */

class ToolCallParser {
  constructor() {
    // Custom format regex: {{tool:toolName|param1=value1|param2=value2}}
    this.customFormatRegex = /\{\{tool:([a-zA-Z0-9_-]+)(?:\|([^}]+))?\}\}/g;
  }

  /**
   * Parse a tool call object from OpenAI/Anthropic format
   * @param {Object} toolCall - Tool call object
   * @returns {Object} - Parsed tool call with name and arguments
   */
  parseToolCall(toolCall) {
    try {
      // OpenAI format
      if (toolCall.function) {
        const args = typeof toolCall.function.arguments === 'string'
          ? JSON.parse(toolCall.function.arguments)
          : toolCall.function.arguments;

        return {
          valid: true,
          id: toolCall.id,
          name: toolCall.function.name,
          arguments: args
        };
      }

      // Anthropic format (tool_use block)
      if (toolCall.name && toolCall.input !== undefined) {
        return {
          valid: true,
          id: toolCall.id,
          name: toolCall.name,
          arguments: toolCall.input
        };
      }

      // Custom format (already parsed)
      if (toolCall.toolName && toolCall.params !== undefined) {
        return {
          valid: true,
          id: toolCall.id || `custom_${Date.now()}`,
          name: toolCall.toolName,
          arguments: toolCall.params
        };
      }

      return {
        valid: false,
        error: 'Unknown tool call format'
      };
    } catch (error) {
      return {
        valid: false,
        error: `Failed to parse tool call: ${error.message}`,
        raw: toolCall
      };
    }
  }

  /**
   * Extract tool calls from message content using custom format
   * Format: {{tool:toolName|param1=value1|param2=value2}}
   * @param {string} message - Message content
   * @returns {Array} - Array of extracted tool calls
   */
  extractToolCalls(message) {
    if (!message || typeof message !== 'string') {
      return [];
    }

    const toolCalls = [];
    let match;

    // Reset regex state
    this.customFormatRegex.lastIndex = 0;

    while ((match = this.customFormatRegex.exec(message)) !== null) {
      const toolName = match[1];
      const paramsString = match[2] || '';

      // Parse parameters
      const params = this.parseParams(paramsString);

      toolCalls.push({
        id: `custom_${Date.now()}_${toolCalls.length}`,
        toolName,
        params,
        raw: match[0]
      });
    }

    return toolCalls;
  }

  /**
   * Parse parameter string from custom format
   * @param {string} paramsString - Parameter string (param1=value1|param2=value2)
   * @returns {Object} - Parsed parameters
   */
  parseParams(paramsString) {
    if (!paramsString) {
      return {};
    }

    const params = {};
    const pairs = paramsString.split('|');

    for (const pair of pairs) {
      const [key, ...valueParts] = pair.split('=');
      const value = valueParts.join('='); // Handle values with = in them

      if (key) {
        params[key.trim()] = this.parseValue(value);
      }
    }

    return params;
  }

  /**
   * Parse value to appropriate type
   * @param {string} value - String value
   * @returns {any} - Parsed value
   */
  parseValue(value) {
    if (value === undefined || value === '') {
      return null;
    }

    const trimmed = value.trim();

    // Boolean
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;

    // Null
    if (trimmed === 'null') return null;

    // Number
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      return parseFloat(trimmed);
    }

    // JSON object or array
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
        (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        return JSON.parse(trimmed);
      } catch {
        return trimmed;
      }
    }

    // String (remove quotes if present)
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
      return trimmed.slice(1, -1);
    }

    return trimmed;
  }

  /**
   * Format tool result for inclusion in response
   * @param {string} toolName - Name of the tool
   * @param {Object} result - Tool execution result
   * @returns {string} - Formatted result string
   */
  formatToolResult(toolName, result) {
    const status = result.success ? 'SUCCESS' : 'ERROR';
    const content = result.success
      ? JSON.stringify(result.result, null, 2)
      : result.error;

    return `[Tool Result: ${toolName}]\nStatus: ${status}\n${content}`;
  }

  /**
   * Build tool call in custom format
   * @param {string} toolName - Tool name
   * @param {Object} params - Parameters
   * @returns {string} - Custom format string
   */
  buildCustomFormat(toolName, params) {
    if (!params || Object.keys(params).length === 0) {
      return `{{tool:${toolName}}}`;
    }

    const paramsString = Object.entries(params)
      .map(([key, value]) => {
        const valueStr = typeof value === 'object'
          ? JSON.stringify(value)
          : String(value);
        return `${key}=${valueStr}`;
      })
      .join('|');

    return `{{tool:${toolName}|${paramsString}}}`;
  }

  /**
   * Build OpenAI function call format
   * @param {string} toolName - Tool name
   * @param {Object} params - Parameters
   * @returns {Object} - OpenAI function call object
   */
  buildOpenAIFormat(toolName, params) {
    return {
      type: 'function',
      function: {
        name: toolName,
        arguments: JSON.stringify(params || {})
      }
    };
  }

  /**
   * Build Anthropic tool use format
   * @param {string} toolName - Tool name
   * @param {Object} params - Parameters
   * @returns {Object} - Anthropic tool use object
   */
  buildAnthropicFormat(toolName, params) {
    return {
      type: 'tool_use',
      id: `toolu_${Date.now()}`,
      name: toolName,
      input: params || {}
    };
  }

  /**
   * Validate tool call parameters against schema
   * @param {Object} params - Parameters to validate
   * @param {Object} schema - JSON Schema
   * @returns {Object} - Validation result
   */
  validateParams(params, schema) {
    if (!schema) {
      return { valid: true };
    }

    const errors = [];
    const properties = schema.properties || {};
    const required = schema.required || [];

    // Check required fields
    for (const field of required) {
      if (params[field] === undefined || params[field] === null) {
        errors.push(`Missing required field: ${field}`);
      }
    }

    // Check types
    for (const [key, value] of Object.entries(params)) {
      const propSchema = properties[key];
      if (!propSchema) continue;

      const expectedType = propSchema.type;
      const actualType = Array.isArray(value) ? 'array' : typeof value;

      if (expectedType && actualType !== expectedType) {
        if (!(expectedType === 'integer' && actualType === 'number' && Number.isInteger(value))) {
          errors.push(`Invalid type for ${key}: expected ${expectedType}, got ${actualType}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

module.exports = ToolCallParser;
