/**
 * Tool Executor - Executes tools and manages execution lifecycle
 */

const db = require('../../db');
const Ajv = require('ajv');
const { executeInSandbox } = require('../../utils/codeSandbox');

class ToolExecutor {
  constructor() {
    this.ajv = new Ajv({ allErrors: true, strict: false });
  }

  /**
   * Execute a tool with given input
   * @param {Object} tool - Tool configuration
   * @param {Object} input - Input parameters
   * @param {Object} context - Execution context (agentId, executionId, etc.)
   * @returns {Object} - Execution result
   */
  async execute(tool, input, context = {}) {
    const startTime = Date.now();
    let executionId = null;

    try {
      // Validate input
      this.validateInput(tool, input);

      // Create execution record
      executionId = await this.createExecution(tool.id, context, input);

      // Update status to running
      await this.updateExecutionStatus(executionId, 'running');

      // Execute based on tool type
      let output;
      switch (tool.tool_type) {
        case 'http_request':
          output = await this.executeHttpRequest(tool, input, context);
          break;
        case 'database_query':
          output = await this.executeDatabaseQuery(tool, input, context);
          break;
        case 'code_execution':
          output = await this.executeCode(tool, input, context);
          break;
        case 'custom':
          output = await this.executeCustom(tool, input, context);
          break;
        default:
          throw new Error(`Unknown tool type: ${tool.tool_type}`);
      }

      // Format output
      const formattedOutput = this.formatOutput(tool, output);

      // Calculate duration
      const durationMs = Date.now() - startTime;

      // Update execution record
      await this.completeExecution(executionId, formattedOutput, durationMs);

      return {
        success: true,
        output: formattedOutput,
        duration_ms: durationMs,
        execution_id: executionId
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;

      if (executionId) {
        await this.failExecution(executionId, error.message, durationMs);
      }

      return {
        success: false,
        error: error.message,
        duration_ms: durationMs,
        execution_id: executionId
      };
    }
  }

  /**
   * Validate input against tool's input schema
   * @param {Object} tool - Tool configuration
   * @param {Object} input - Input to validate
   * @throws {Error} - If validation fails
   */
  validateInput(tool, input) {
    if (!tool.input_schema) {
      return; // No schema, skip validation
    }

    const validate = this.ajv.compile(tool.input_schema);
    const valid = validate(input);

    if (!valid) {
      const errors = validate.errors.map(e => `${e.instancePath} ${e.message}`).join(', ');
      throw new Error(`Input validation failed: ${errors}`);
    }
  }

  /**
   * Format output according to tool's output schema
   * @param {Object} tool - Tool configuration
   * @param {any} output - Raw output
   * @returns {any} - Formatted output
   */
  formatOutput(tool, output) {
    if (!tool.output_schema) {
      return output;
    }

    // If output schema defines expected structure, validate it
    try {
      const validate = this.ajv.compile(tool.output_schema);
      const valid = validate(output);

      if (!valid) {
        // Return output with validation warning
        return {
          data: output,
          _validation_warnings: validate.errors
        };
      }
    } catch (error) {
      // Schema compilation error, return raw output
      return output;
    }

    return output;
  }

  /**
   * Execute HTTP request tool
   * @param {Object} tool - Tool configuration
   * @param {Object} input - Request parameters
   * @param {Object} context - Execution context
   * @returns {Object} - Response data
   */
  async executeHttpRequest(tool, input, context) {
    const config = tool.configuration;
    const url = this.interpolateString(config.url, input);
    const method = config.method || 'GET';
    const headers = { ...config.headers };

    // Interpolate header values
    Object.keys(headers).forEach(key => {
      headers[key] = this.interpolateString(headers[key], input);
    });

    const fetchOptions = {
      method,
      headers
    };

    if (['POST', 'PUT', 'PATCH'].includes(method) && input.body) {
      fetchOptions.body = JSON.stringify(input.body);
      if (!headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
      }
    }

    const response = await fetch(url, fetchOptions);
    const contentType = response.headers.get('content-type');

    let data;
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    return {
      status: response.status,
      statusText: response.statusText,
      data
    };
  }

  /**
   * Execute database query tool
   * @param {Object} tool - Tool configuration
   * @param {Object} input - Query parameters
   * @param {Object} context - Execution context
   * @returns {Object} - Query results
   */
  async executeDatabaseQuery(tool, input, context) {
    const config = tool.configuration;
    const query = this.interpolateString(config.query, input);
    const params = (config.params || []).map(p => input[p]);

    const result = await db.query(query, params);

    return {
      rows: result.rows,
      rowCount: result.rowCount
    };
  }

  /**
   * Execute code tool (sandboxed)
   * SECURITY: Uses vm-based sandbox instead of Function() constructor
   * @param {Object} tool - Tool configuration
   * @param {Object} input - Input parameters
   * @param {Object} context - Execution context
   * @returns {any} - Execution result
   */
  async executeCode(tool, input, context) {
    const config = tool.configuration;
    const code = config.code;
    const timeoutMs = Math.min(config.timeout || 5000, 30000); // Max 30 seconds

    // SECURITY: Execute in isolated sandbox (no new Function!)
    const sandboxResult = await executeInSandbox(code, {
      input: Object.freeze({ ...input }),
      context: Object.freeze({ ...context })
    }, {
      timeout: timeoutMs
    });

    if (!sandboxResult.success) {
      throw new Error(sandboxResult.error || 'Code execution failed');
    }

    return sandboxResult.result;
  }

  /**
   * Execute custom tool
   * @param {Object} tool - Tool configuration
   * @param {Object} input - Input parameters
   * @param {Object} context - Execution context
   * @returns {any} - Execution result
   */
  async executeCustom(tool, input, context) {
    const config = tool.configuration;

    // Custom tools should define a handler path
    if (config.handler) {
      const handler = require(config.handler);
      return await handler(tool, input, context);
    }

    throw new Error('Custom tool must define a handler');
  }

  /**
   * Interpolate variables in a string
   * @param {string} str - String with {{variable}} placeholders
   * @param {Object} data - Data to interpolate
   * @returns {string} - Interpolated string
   */
  interpolateString(str, data) {
    if (typeof str !== 'string') return str;

    return str.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, path) => {
      const keys = path.split('.');
      let value = data;
      for (const key of keys) {
        if (value && typeof value === 'object' && key in value) {
          value = value[key];
        } else {
          return match; // Keep original if path not found
        }
      }
      return value;
    });
  }

  /**
   * Create execution record
   */
  async createExecution(toolId, context, input) {
    const result = await db.query(
      `INSERT INTO tool_executions (tool_id, agent_id, execution_id, input, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING id`,
      [toolId, context.agentId || null, context.executionId || null, JSON.stringify(input)]
    );
    return result.rows[0].id;
  }

  /**
   * Update execution status
   */
  async updateExecutionStatus(executionId, status) {
    await db.query(
      'UPDATE tool_executions SET status = $1 WHERE id = $2',
      [status, executionId]
    );
  }

  /**
   * Complete execution
   */
  async completeExecution(executionId, output, durationMs) {
    await db.query(
      'UPDATE tool_executions SET status = $1, output = $2, duration_ms = $3 WHERE id = $4',
      ['completed', JSON.stringify(output), durationMs, executionId]
    );
  }

  /**
   * Fail execution
   */
  async failExecution(executionId, error, durationMs) {
    await db.query(
      'UPDATE tool_executions SET status = $1, error = $2, duration_ms = $3 WHERE id = $4',
      ['failed', error, durationMs, executionId]
    );
  }
}

module.exports = ToolExecutor;
