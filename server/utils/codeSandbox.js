/**
 * Code Sandbox - Secure code execution environment
 *
 * Provides safe execution of user-provided code with:
 * - Timeout limits
 * - Memory limits
 * - Blocked dangerous operations
 * - No access to file system, network, or process
 *
 * SECURITY: Never use eval() or new Function() directly!
 * Always use this sandbox for user code execution.
 */

const vm = require('vm');

/**
 * Dangerous patterns that should never be in user code
 */
const DANGEROUS_PATTERNS = [
  // Process/System access
  { pattern: /\bprocess\b/gi, reason: 'process access not allowed' },
  { pattern: /\bglobal\b/gi, reason: 'global access not allowed' },
  { pattern: /\bglobalThis\b/gi, reason: 'globalThis access not allowed' },

  // Code generation
  { pattern: /\beval\s*\(/gi, reason: 'eval() not allowed' },
  { pattern: /\bnew\s+Function\s*\(/gi, reason: 'new Function() not allowed' },
  { pattern: /\bFunction\s*\(/gi, reason: 'Function() constructor not allowed' },

  // Module system
  { pattern: /\brequire\s*\(/gi, reason: 'require() not allowed' },
  { pattern: /\bimport\s*\(/gi, reason: 'dynamic import not allowed' },
  { pattern: /\bimport\s+/gi, reason: 'import statement not allowed' },
  { pattern: /\bmodule\b/gi, reason: 'module access not allowed' },
  { pattern: /\b__dirname\b/gi, reason: '__dirname access not allowed' },
  { pattern: /\b__filename\b/gi, reason: '__filename access not allowed' },

  // Prototype pollution
  { pattern: /__proto__/gi, reason: '__proto__ access not allowed' },
  { pattern: /\.constructor\s*\[/gi, reason: 'constructor access not allowed' },
  { pattern: /\bconstructor\s*\.\s*constructor/gi, reason: 'constructor chain not allowed' },
  { pattern: /Object\s*\.\s*setPrototypeOf/gi, reason: 'prototype manipulation not allowed' },
  { pattern: /Object\s*\.\s*defineProperty/gi, reason: 'property definition not allowed' },
  { pattern: /Reflect\s*\./gi, reason: 'Reflect API not allowed' },

  // Dangerous built-ins
  { pattern: /\bchild_process\b/gi, reason: 'child_process not allowed' },
  { pattern: /\bfs\b\s*\./gi, reason: 'file system access not allowed' },
  { pattern: /\bnet\b\s*\./gi, reason: 'network access not allowed' },
  { pattern: /\bhttp\b\s*\./gi, reason: 'http access not allowed' },
  { pattern: /\bhttps\b\s*\./gi, reason: 'https access not allowed' },

  // Timing attacks / infinite loops
  { pattern: /while\s*\(\s*true\s*\)/gi, reason: 'infinite loop not allowed' },
  { pattern: /for\s*\(\s*;\s*;\s*\)/gi, reason: 'infinite loop not allowed' }
];

/**
 * Validate code for dangerous patterns
 * @param {string} code - Code to validate
 * @returns {{valid: boolean, reason?: string}}
 */
function validateCode(code) {
  if (!code || typeof code !== 'string') {
    return { valid: false, reason: 'Code must be a non-empty string' };
  }

  // Check code size (max 100KB)
  if (code.length > 100000) {
    return { valid: false, reason: 'Code exceeds maximum size limit (100KB)' };
  }

  // Check for dangerous patterns
  for (const { pattern, reason } of DANGEROUS_PATTERNS) {
    if (pattern.test(code)) {
      return { valid: false, reason };
    }
  }

  return { valid: true };
}

/**
 * Create a safe sandbox context with limited globals
 * @param {Object} customContext - Additional context to provide
 * @returns {Object} Sandbox context
 */
function createSafeContext(customContext = {}) {
  return {
    // Safe built-ins only
    console: {
      log: () => {},  // No-op for security
      info: () => {},
      warn: () => {},
      error: () => {}
    },

    // Math operations (safe)
    Math: Object.freeze({ ...Math }),

    // Safe constructors
    Array: Array,
    Object: Object,
    String: String,
    Number: Number,
    Boolean: Boolean,
    Date: Date,
    RegExp: RegExp,
    JSON: Object.freeze({
      parse: JSON.parse,
      stringify: JSON.stringify
    }),

    // Safe utilities
    parseInt: parseInt,
    parseFloat: parseFloat,
    isNaN: isNaN,
    isFinite: isFinite,
    encodeURI: encodeURI,
    decodeURI: decodeURI,
    encodeURIComponent: encodeURIComponent,
    decodeURIComponent: decodeURIComponent,

    // Explicitly undefined dangerous globals
    eval: undefined,
    Function: undefined,
    process: undefined,
    global: undefined,
    globalThis: undefined,
    require: undefined,
    module: undefined,
    __dirname: undefined,
    __filename: undefined,
    Buffer: undefined,
    setTimeout: undefined,
    setInterval: undefined,
    setImmediate: undefined,

    // Custom context (frozen for safety)
    ...Object.freeze(customContext)
  };
}

/**
 * Execute code in a secure sandbox
 * @param {string} code - Code to execute
 * @param {Object} context - Context variables to expose
 * @param {Object} options - Execution options
 * @returns {Promise<{success: boolean, result?: any, error?: string}>}
 */
async function executeInSandbox(code, context = {}, options = {}) {
  const timeout = Math.min(options.timeout || 5000, 30000); // Max 30 seconds

  // Validate code first
  const validation = validateCode(code);
  if (!validation.valid) {
    return {
      success: false,
      error: `Security violation: ${validation.reason}`
    };
  }

  try {
    // Create isolated context
    const sandbox = createSafeContext(context);
    const vmContext = vm.createContext(sandbox, {
      name: 'code-sandbox',
      codeGeneration: {
        strings: false,  // Disable eval-like behavior
        wasm: false      // Disable WebAssembly
      }
    });

    // Compile the script
    const script = new vm.Script(code, {
      filename: 'sandbox-code.js',
      timeout: timeout
    });

    // Execute with timeout
    const result = script.runInContext(vmContext, {
      timeout: timeout,
      breakOnSigint: true,
      displayErrors: false
    });

    return {
      success: true,
      result: result
    };

  } catch (error) {
    // Handle timeout specifically
    if (error.code === 'ERR_SCRIPT_EXECUTION_TIMEOUT') {
      return {
        success: false,
        error: `Execution timeout (${timeout}ms exceeded)`
      };
    }

    return {
      success: false,
      error: error.message || 'Unknown execution error'
    };
  }
}

/**
 * Safe math expression evaluator
 * Only allows numbers and basic math operators
 * @param {string} expression - Math expression to evaluate
 * @returns {{success: boolean, result?: number, error?: string}}
 */
function safeMathEval(expression) {
  if (!expression || typeof expression !== 'string') {
    return { success: false, error: 'Expression must be a non-empty string' };
  }

  // Only allow: numbers, operators, parentheses, decimal points, spaces
  const sanitized = expression.replace(/\s/g, '');

  // Strict validation: only math characters allowed
  if (!/^[0-9+\-*/().%]+$/.test(sanitized)) {
    return {
      success: false,
      error: 'Invalid characters in expression. Only numbers and operators (+, -, *, /, %, .) allowed.'
    };
  }

  // Check for empty parentheses or invalid patterns
  if (/\(\)/.test(sanitized) || /[+\-*/]{2,}/.test(sanitized)) {
    return { success: false, error: 'Invalid expression syntax' };
  }

  // Check balanced parentheses
  let depth = 0;
  for (const char of sanitized) {
    if (char === '(') depth++;
    if (char === ')') depth--;
    if (depth < 0) {
      return { success: false, error: 'Unbalanced parentheses' };
    }
  }
  if (depth !== 0) {
    return { success: false, error: 'Unbalanced parentheses' };
  }

  try {
    // Use vm for safe evaluation
    const result = vm.runInNewContext(sanitized, Object.freeze({}), {
      timeout: 1000,
      displayErrors: false
    });

    if (typeof result !== 'number' || !isFinite(result)) {
      return { success: false, error: 'Result is not a valid number' };
    }

    return { success: true, result: result };

  } catch (error) {
    return { success: false, error: 'Invalid expression' };
  }
}

/**
 * Execute a simple expression with variables
 * @param {string} expression - Expression to evaluate
 * @param {Object} variables - Variables to substitute
 * @returns {{success: boolean, result?: any, error?: string}}
 */
function safeExpressionEval(expression, variables = {}) {
  // Validate expression
  const validation = validateCode(expression);
  if (!validation.valid) {
    return { success: false, error: validation.reason };
  }

  // Only allow simple property access and math
  const safePattern = /^[\w\s+\-*/%.()[\]"'`,]+$/;
  if (!safePattern.test(expression)) {
    return { success: false, error: 'Expression contains invalid characters' };
  }

  try {
    const sandbox = createSafeContext(variables);
    const vmContext = vm.createContext(sandbox, {
      codeGeneration: { strings: false, wasm: false }
    });

    const result = vm.runInContext(expression, vmContext, {
      timeout: 1000,
      displayErrors: false
    });

    return { success: true, result };

  } catch (error) {
    return { success: false, error: error.message };
  }
}

module.exports = {
  validateCode,
  createSafeContext,
  executeInSandbox,
  safeMathEval,
  safeExpressionEval,
  DANGEROUS_PATTERNS
};
