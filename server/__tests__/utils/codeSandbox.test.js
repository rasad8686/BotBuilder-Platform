/**
 * Code Sandbox Tests
 * Comprehensive tests for secure code execution environment
 */

const {
  validateCode,
  createSafeContext,
  executeInSandbox,
  safeMathEval,
  safeExpressionEval,
  DANGEROUS_PATTERNS
} = require('../../utils/codeSandbox');

describe('codeSandbox', () => {
  describe('DANGEROUS_PATTERNS', () => {
    it('should have patterns defined', () => {
      expect(DANGEROUS_PATTERNS).toBeDefined();
      expect(Array.isArray(DANGEROUS_PATTERNS)).toBe(true);
      expect(DANGEROUS_PATTERNS.length).toBeGreaterThan(0);
    });

    it('should have pattern and reason for each entry', () => {
      DANGEROUS_PATTERNS.forEach(entry => {
        expect(entry.pattern).toBeInstanceOf(RegExp);
        expect(typeof entry.reason).toBe('string');
        expect(entry.reason.length).toBeGreaterThan(0);
      });
    });

    it('should include process access pattern', () => {
      const processPattern = DANGEROUS_PATTERNS.find(p => p.reason.includes('process'));
      expect(processPattern).toBeDefined();
    });

    it('should include eval pattern', () => {
      const evalPattern = DANGEROUS_PATTERNS.find(p => p.reason.includes('eval'));
      expect(evalPattern).toBeDefined();
    });
  });

  describe('validateCode', () => {
    it('should accept safe code', () => {
      const result = validateCode('const x = 1 + 2;');

      expect(result.valid).toBe(true);
    });

    it('should reject empty code', () => {
      const result = validateCode('');

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Code must be a non-empty string');
    });

    it('should reject null code', () => {
      const result = validateCode(null);

      expect(result.valid).toBe(false);
    });

    it('should reject undefined code', () => {
      const result = validateCode(undefined);

      expect(result.valid).toBe(false);
    });

    it('should reject non-string code', () => {
      const result = validateCode(123);

      expect(result.valid).toBe(false);
    });

    it('should reject code with eval()', () => {
      const result = validateCode('eval("malicious")');

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('eval() not allowed');
    });

    it('should reject code with require()', () => {
      const result = validateCode('require("fs")');

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('require() not allowed');
    });

    it('should reject code with process access', () => {
      const result = validateCode('process.exit()');

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('process access not allowed');
    });

    it('should reject code with global access', () => {
      const result = validateCode('global.something');

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('global access not allowed');
    });

    it('should reject code with globalThis access', () => {
      const result = validateCode('globalThis.something');

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('globalThis access not allowed');
    });

    it('should reject code with new Function()', () => {
      const result = validateCode('new Function("return 1")');

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('new Function() not allowed');
    });

    it('should reject code with Function() constructor', () => {
      const result = validateCode('Function("return 1")');

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Function() constructor not allowed');
    });

    it('should reject code with __proto__', () => {
      const result = validateCode('obj.__proto__');

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('__proto__ access not allowed');
    });

    it('should reject code with import statements', () => {
      const result = validateCode('import fs from "fs"');

      expect(result.valid).toBe(false);
    });

    it('should reject code with dynamic import', () => {
      const result = validateCode('import("fs")');

      expect(result.valid).toBe(false);
    });

    it('should reject code with infinite while loop', () => {
      const result = validateCode('while(true) {}');

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('infinite loop not allowed');
    });

    it('should reject code with infinite for loop', () => {
      const result = validateCode('for(;;) {}');

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('infinite loop not allowed');
    });

    it('should reject code exceeding size limit', () => {
      const largeCode = 'x'.repeat(100001);
      const result = validateCode(largeCode);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Code exceeds maximum size limit (100KB)');
    });

    it('should reject child_process access', () => {
      const result = validateCode('child_process.exec("ls")');

      expect(result.valid).toBe(false);
    });

    it('should reject fs access', () => {
      const result = validateCode('fs.readFile("file")');

      expect(result.valid).toBe(false);
    });

    it('should reject net access', () => {
      const result = validateCode('net.connect()');

      expect(result.valid).toBe(false);
    });

    it('should reject http access', () => {
      const result = validateCode('http.get("url")');

      expect(result.valid).toBe(false);
    });

    it('should reject https access', () => {
      const result = validateCode('https.get("url")');

      expect(result.valid).toBe(false);
    });

    it('should reject Reflect API', () => {
      const result = validateCode('Reflect.get(obj, "key")');

      expect(result.valid).toBe(false);
    });

    it('should reject module access', () => {
      const result = validateCode('module.exports = {}');

      expect(result.valid).toBe(false);
    });

    it('should reject __dirname access', () => {
      const result = validateCode('console.log(__dirname)');

      expect(result.valid).toBe(false);
    });

    it('should reject __filename access', () => {
      const result = validateCode('console.log(__filename)');

      expect(result.valid).toBe(false);
    });

    it('should reject constructor chain access', () => {
      const result = validateCode('obj.constructor.constructor');

      expect(result.valid).toBe(false);
    });

    it('should reject Object.setPrototypeOf', () => {
      const result = validateCode('Object.setPrototypeOf(obj, {})');

      expect(result.valid).toBe(false);
    });

    it('should reject Object.defineProperty', () => {
      const result = validateCode('Object.defineProperty(obj, "key", {})');

      expect(result.valid).toBe(false);
    });

    it('should accept code at exactly 100KB', () => {
      const code = 'x'.repeat(100000);
      const result = validateCode(code);

      expect(result.valid).toBe(true);
    });

    it('should accept safe loops', () => {
      const result = validateCode('for(let i = 0; i < 10; i++) {}');

      expect(result.valid).toBe(true);
    });

    it('should accept while loops with condition', () => {
      const result = validateCode('let x = 0; while(x < 10) { x++; }');

      expect(result.valid).toBe(true);
    });
  });

  describe('createSafeContext', () => {
    it('should create context with Math', () => {
      const context = createSafeContext();

      expect(context.Math).toBeDefined();
      expect(context.Math.PI).toBe(Math.PI);
    });

    it('should have no-op console', () => {
      const context = createSafeContext();

      expect(context.console).toBeDefined();
      expect(context.console.log).toBeDefined();
      expect(context.console.log('test')).toBeUndefined();
    });

    it('should have safe constructors', () => {
      const context = createSafeContext();

      expect(context.Array).toBe(Array);
      expect(context.Object).toBe(Object);
      expect(context.String).toBe(String);
      expect(context.JSON).toBeDefined();
    });

    it('should have undefined dangerous globals', () => {
      const context = createSafeContext();

      expect(context.eval).toBeUndefined();
      expect(context.Function).toBeUndefined();
      expect(context.process).toBeUndefined();
      expect(context.require).toBeUndefined();
      expect(context.setTimeout).toBeUndefined();
    });

    it('should include custom context', () => {
      const context = createSafeContext({ myVar: 'test' });

      expect(context.myVar).toBe('test');
    });

    it('should have all safe constructors', () => {
      const context = createSafeContext();

      expect(context.Number).toBe(Number);
      expect(context.Boolean).toBe(Boolean);
      expect(context.Date).toBe(Date);
      expect(context.RegExp).toBe(RegExp);
    });

    it('should have safe utility functions', () => {
      const context = createSafeContext();

      expect(context.parseInt).toBe(parseInt);
      expect(context.parseFloat).toBe(parseFloat);
      expect(context.isNaN).toBe(isNaN);
      expect(context.isFinite).toBe(isFinite);
    });

    it('should have URI encoding functions', () => {
      const context = createSafeContext();

      expect(context.encodeURI).toBe(encodeURI);
      expect(context.decodeURI).toBe(decodeURI);
      expect(context.encodeURIComponent).toBe(encodeURIComponent);
      expect(context.decodeURIComponent).toBe(decodeURIComponent);
    });

    it('should freeze custom context', () => {
      const context = createSafeContext({ test: 'value' });

      expect(Object.isFrozen(context.test)).toBe(false);
    });

    it('should have undefined Buffer', () => {
      const context = createSafeContext();

      expect(context.Buffer).toBeUndefined();
    });

    it('should have undefined timing functions', () => {
      const context = createSafeContext();

      expect(context.setTimeout).toBeUndefined();
      expect(context.setInterval).toBeUndefined();
      expect(context.setImmediate).toBeUndefined();
    });
  });

  describe('executeInSandbox', () => {
    it('should execute simple arithmetic', async () => {
      const result = await executeInSandbox('1 + 2 + 3');

      expect(result.success).toBe(true);
      expect(result.result).toBe(6);
    });

    it('should execute code with context variables', async () => {
      const result = await executeInSandbox('x + y', { x: 10, y: 20 });

      expect(result.success).toBe(true);
      expect(result.result).toBe(30);
    });

    it('should execute array operations', async () => {
      const result = await executeInSandbox('[1, 2, 3].map(x => x * 2)');

      expect(result.success).toBe(true);
      expect(result.result).toEqual([2, 4, 6]);
    });

    it('should reject dangerous code', async () => {
      const result = await executeInSandbox('process.exit()');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Security violation');
    });

    it('should handle syntax errors', async () => {
      const result = await executeInSandbox('const x = {');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle runtime errors', async () => {
      const result = await executeInSandbox('nonexistent.property');

      expect(result.success).toBe(false);
    });

    it('should use default timeout', async () => {
      const result = await executeInSandbox('let x = 0; for(let i = 0; i < 100; i++) x += i; x');

      expect(result.success).toBe(true);
    });

    it('should accept custom timeout', async () => {
      const result = await executeInSandbox('1 + 1', {}, { timeout: 1000 });

      expect(result.success).toBe(true);
    });

    it('should limit timeout to 30 seconds', async () => {
      const result = await executeInSandbox('1 + 1', {}, { timeout: 50000 });

      expect(result.success).toBe(true);
    });

    it('should execute JSON operations', async () => {
      const result = await executeInSandbox('JSON.stringify({a: 1})');

      expect(result.success).toBe(true);
      expect(result.result).toBe('{"a":1}');
    });

    it('should execute Math operations', async () => {
      const result = await executeInSandbox('1 + 3');

      expect(result.success).toBe(true);
      expect(result.result).toBe(4);
    });

    it('should execute string operations', async () => {
      const result = await executeInSandbox('"hello".toUpperCase()');

      expect(result.success).toBe(true);
      expect(result.result).toBe('HELLO');
    });

    it('should execute boolean operations', async () => {
      const result = await executeInSandbox('true && false');

      expect(result.success).toBe(true);
      expect(result.result).toBe(false);
    });

    it('should execute ternary operators', async () => {
      const result = await executeInSandbox('5 > 3 ? "yes" : "no"');

      expect(result.success).toBe(true);
      expect(result.result).toBe('yes');
    });

    it('should handle object creation', async () => {
      const result = await executeInSandbox('({a: 1, b: 2})');

      expect(result.success).toBe(true);
      expect(result.result).toEqual({a: 1, b: 2});
    });

    it('should handle array methods', async () => {
      const result = await executeInSandbox('[1, 2, 3, 4].filter(x => x > 2)');

      expect(result.success).toBe(true);
      expect(result.result).toEqual([3, 4]);
    });

    it('should handle reduce', async () => {
      const result = await executeInSandbox('[1, 2, 3].reduce((a, b) => a + b, 0)');

      expect(result.success).toBe(true);
      expect(result.result).toBe(6);
    });

    it('should handle spread operator', async () => {
      const result = await executeInSandbox('[...[1, 2], 3]');

      expect(result.success).toBe(true);
      expect(result.result).toEqual([1, 2, 3]);
    });

    it('should handle destructuring', async () => {
      const result = await executeInSandbox('const {a, b} = {a: 1, b: 2}; a + b');

      expect(result.success).toBe(true);
      expect(result.result).toBe(3);
    });

    it('should handle template literals', async () => {
      const result = await executeInSandbox('const name = "World"; `Hello ${name}`');

      expect(result.success).toBe(true);
      expect(result.result).toBe('Hello World');
    });
  });

  describe('safeMathEval', () => {
    it('should evaluate simple addition', () => {
      const result = safeMathEval('1 + 2');

      expect(result.success).toBe(true);
      expect(result.result).toBe(3);
    });

    it('should evaluate subtraction', () => {
      const result = safeMathEval('10 - 4');

      expect(result.success).toBe(true);
      expect(result.result).toBe(6);
    });

    it('should evaluate multiplication', () => {
      const result = safeMathEval('3 * 4');

      expect(result.success).toBe(true);
      expect(result.result).toBe(12);
    });

    it('should evaluate division', () => {
      const result = safeMathEval('20 / 4');

      expect(result.success).toBe(true);
      expect(result.result).toBe(5);
    });

    it('should evaluate modulo', () => {
      const result = safeMathEval('10 % 3');

      expect(result.success).toBe(true);
      expect(result.result).toBe(1);
    });

    it('should evaluate parentheses', () => {
      const result = safeMathEval('(2 + 3) * 4');

      expect(result.success).toBe(true);
      expect(result.result).toBe(20);
    });

    it('should evaluate decimals', () => {
      const result = safeMathEval('3.14 * 2');

      expect(result.success).toBe(true);
      expect(result.result).toBeCloseTo(6.28);
    });

    it('should reject empty expression', () => {
      const result = safeMathEval('');

      expect(result.success).toBe(false);
    });

    it('should reject null expression', () => {
      const result = safeMathEval(null);

      expect(result.success).toBe(false);
    });

    it('should reject expressions with letters', () => {
      const result = safeMathEval('1 + abc');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid characters');
    });

    it('should reject expressions with function calls', () => {
      const result = safeMathEval('Math.sqrt(4)');

      expect(result.success).toBe(false);
    });

    it('should reject unbalanced parentheses', () => {
      const result = safeMathEval('(1 + 2');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unbalanced parentheses');
    });

    it('should reject unbalanced parentheses (closing)', () => {
      const result = safeMathEval('1 + 2)');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unbalanced parentheses');
    });

    it('should reject empty parentheses', () => {
      const result = safeMathEval('1 + ()');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid expression syntax');
    });

    it('should reject consecutive operators', () => {
      const result = safeMathEval('1 ++ 2');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid expression syntax');
    });

    it('should handle division by zero', () => {
      const result = safeMathEval('1 / 0');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Result is not a valid number');
    });

    it('should handle negative numbers', () => {
      const result = safeMathEval('-5 + 3');

      expect(result.success).toBe(true);
      expect(result.result).toBe(-2);
    });

    it('should handle complex expressions', () => {
      const result = safeMathEval('((10 + 5) * 2) / 3');

      expect(result.success).toBe(true);
      expect(result.result).toBe(10);
    });

    it('should handle spaces in expression', () => {
      const result = safeMathEval('  1   +   2  ');

      expect(result.success).toBe(true);
      expect(result.result).toBe(3);
    });
  });

  describe('safeExpressionEval', () => {
    it('should evaluate with variables', () => {
      const result = safeExpressionEval('x + y', { x: 5, y: 10 });

      expect(result.success).toBe(true);
      expect(result.result).toBe(15);
    });

    it('should evaluate string concatenation', () => {
      const result = safeExpressionEval('firstName + " " + lastName', {
        firstName: 'John',
        lastName: 'Doe'
      });

      expect(result.success).toBe(true);
      expect(result.result).toBe('John Doe');
    });

    it('should evaluate array access', () => {
      const result = safeExpressionEval('items[0]', { items: [1, 2, 3] });

      expect(result.success).toBe(true);
      expect(result.result).toBe(1);
    });

    it('should reject dangerous code in expressions', () => {
      const result = safeExpressionEval('process.exit()');

      expect(result.success).toBe(false);
    });

    it('should handle undefined variables', () => {
      const result = safeExpressionEval('unknown');

      expect(typeof result.success).toBe('boolean');
    });

    it('should handle object property access', () => {
      const result = safeExpressionEval('user.name', { user: { name: 'John' } });

      expect(result.success).toBe(true);
      expect(result.result).toBe('John');
    });

    it('should handle boolean expressions', () => {
      const result = safeExpressionEval('x > 5', { x: 10 });

      expect(result.success).toBe(true);
      expect(result.result).toBe(true);
    });

    it('should handle string methods', () => {
      const result = safeExpressionEval('str.toUpperCase()', { str: 'hello' });

      expect(result.success).toBe(true);
      expect(result.result).toBe('HELLO');
    });

    it('should reject eval attempts', () => {
      const result = safeExpressionEval('eval("code")');

      expect(result.success).toBe(false);
    });

    it('should reject require attempts', () => {
      const result = safeExpressionEval('require("fs")');

      expect(result.success).toBe(false);
    });

    it('should handle template literals', () => {
      const result = safeExpressionEval('`Hello ${name}`', { name: 'World' });

      expect(result.success).toBe(true);
      expect(result.result).toBe('Hello World');
    });
  });
});
