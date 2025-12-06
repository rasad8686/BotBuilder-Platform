/**
 * CodeTool - Sandboxed JavaScript code execution tool
 */

const vm = require('vm');

class CodeTool {
  constructor(config = {}) {
    this.config = {
      timeout: config.timeout || 5000,
      memoryLimit: config.memoryLimit || 50 * 1024 * 1024, // 50MB
      allowedModules: config.allowedModules || [],
      ...config
    };
  }

  /**
   * Execute JavaScript code in sandbox
   */
  async execute(input, context = {}) {
    const { code, variables = {} } = input;

    if (!code) {
      throw new Error('Code is required');
    }

    // Capture console output
    const consoleOutput = [];
    const mockConsole = {
      log: (...args) => consoleOutput.push({ level: 'log', message: args.map(this.stringify).join(' ') }),
      info: (...args) => consoleOutput.push({ level: 'info', message: args.map(this.stringify).join(' ') }),
      warn: (...args) => consoleOutput.push({ level: 'warn', message: args.map(this.stringify).join(' ') }),
      error: (...args) => consoleOutput.push({ level: 'error', message: args.map(this.stringify).join(' ') })
    };

    // Create sandbox context
    const sandbox = {
      console: mockConsole,
      input: variables,
      context: this.sanitizeContext(context),
      result: undefined,
      // Safe built-ins
      JSON,
      Math,
      Date,
      Array,
      Object,
      String,
      Number,
      Boolean,
      RegExp,
      Map,
      Set,
      Promise,
      parseInt,
      parseFloat,
      isNaN,
      isFinite,
      encodeURIComponent,
      decodeURIComponent,
      encodeURI,
      decodeURI,
      // Utility functions
      setTimeout: undefined, // Disabled for safety
      setInterval: undefined, // Disabled for safety
      fetch: undefined, // Disabled for safety
      require: undefined // Disabled for safety
    };

    // Wrap code to capture return value
    const wrappedCode = `
      (async function() {
        ${code}
      })().then(r => { result = r; }).catch(e => { throw e; });
    `;

    try {
      // Create VM context
      vm.createContext(sandbox);

      // Execute with timeout
      const script = new vm.Script(wrappedCode, {
        filename: 'user-code.js',
        timeout: this.config.timeout
      });

      // Run the script
      script.runInContext(sandbox, {
        timeout: this.config.timeout,
        breakOnSigint: true
      });

      // Wait for async code if result is a promise
      if (sandbox.result instanceof Promise) {
        sandbox.result = await Promise.race([
          sandbox.result,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Async execution timeout')), this.config.timeout)
          )
        ]);
      }

      return {
        success: true,
        result: sandbox.result,
        console: consoleOutput,
        variables: this.extractOutputVariables(sandbox)
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        console: consoleOutput,
        stack: this.sanitizeStack(error.stack)
      };
    }
  }

  /**
   * Stringify value for console output
   */
  stringify(value) {
    if (value === undefined) return 'undefined';
    if (value === null) return 'null';
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value, null, 2);
      } catch {
        return String(value);
      }
    }
    return String(value);
  }

  /**
   * Sanitize context to prevent access to sensitive data
   */
  sanitizeContext(context) {
    const safe = {};
    const allowedKeys = ['executionId', 'agentId', 'timestamp'];

    for (const key of allowedKeys) {
      if (context[key] !== undefined) {
        safe[key] = context[key];
      }
    }

    return safe;
  }

  /**
   * Extract output variables from sandbox
   */
  extractOutputVariables(sandbox) {
    const output = {};
    const ignoreKeys = ['console', 'input', 'context', 'result', 'JSON', 'Math', 'Date',
      'Array', 'Object', 'String', 'Number', 'Boolean', 'RegExp', 'Map', 'Set', 'Promise',
      'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'encodeURIComponent', 'decodeURIComponent',
      'encodeURI', 'decodeURI', 'setTimeout', 'setInterval', 'fetch', 'require'];

    for (const key of Object.keys(sandbox)) {
      if (!ignoreKeys.includes(key)) {
        try {
          // Only include serializable values
          JSON.stringify(sandbox[key]);
          output[key] = sandbox[key];
        } catch {
          // Skip non-serializable values
        }
      }
    }

    return output;
  }

  /**
   * Sanitize error stack trace
   */
  sanitizeStack(stack) {
    if (!stack) return undefined;

    // Remove internal paths and keep only user code references
    return stack
      .split('\n')
      .filter(line => line.includes('user-code.js') || line.includes('at '))
      .slice(0, 5)
      .join('\n');
  }

  /**
   * Validate code for obvious issues
   */
  validateCode(code) {
    const forbidden = [
      'process.',
      'require(',
      'import ',
      'eval(',
      'Function(',
      '__proto__',
      'constructor.constructor'
    ];

    for (const pattern of forbidden) {
      if (code.includes(pattern)) {
        throw new Error(`Forbidden pattern in code: ${pattern}`);
      }
    }

    return true;
  }

  /**
   * Get input schema
   */
  static getInputSchema() {
    return {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'JavaScript code to execute'
        },
        variables: {
          type: 'object',
          description: 'Input variables accessible as "input" object'
        }
      },
      required: ['code']
    };
  }

  /**
   * Get output schema
   */
  static getOutputSchema() {
    return {
      type: 'object',
      properties: {
        success: {
          type: 'boolean',
          description: 'Whether execution was successful'
        },
        result: {
          description: 'Return value of the code'
        },
        console: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              level: { type: 'string', enum: ['log', 'info', 'warn', 'error'] },
              message: { type: 'string' }
            }
          },
          description: 'Console output captured during execution'
        },
        variables: {
          type: 'object',
          description: 'Variables defined in the code'
        },
        error: {
          type: 'string',
          description: 'Error message if execution failed'
        },
        stack: {
          type: 'string',
          description: 'Sanitized stack trace if error occurred'
        }
      }
    };
  }

  /**
   * Get configuration schema
   */
  static getConfigSchema() {
    return {
      type: 'object',
      properties: {
        timeout: {
          type: 'integer',
          default: 5000,
          minimum: 100,
          maximum: 30000,
          description: 'Execution timeout in milliseconds'
        },
        memoryLimit: {
          type: 'integer',
          default: 52428800,
          description: 'Memory limit in bytes (50MB default)'
        },
        allowedModules: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of allowed module names (not implemented)'
        }
      }
    };
  }
}

module.exports = CodeTool;
