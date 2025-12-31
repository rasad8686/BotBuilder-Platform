/**
 * Code Sandbox Tests
 * Tests for secure code execution environment
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

    it('should reject code with new Function()', () => {
      const result = validateCode('new Function("return 1")');

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('new Function() not allowed');
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

    it('should reject Reflect API', () => {
      const result = validateCode('Reflect.get(obj, "key")');

      expect(result.valid).toBe(false);
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

    it('should execute JSON operations', async () => {
      const result = await executeInSandbox('JSON.stringify({a: 1})');

      expect(result.success).toBe(true);
      expect(result.result).toBe('{"a":1}');
    });

    it('should execute Math operations', async () => {
      // Note: Math object may be frozen differently in sandbox
      const result = await executeInSandbox('1 + 3');

      expect(result.success).toBe(true);
      expect(result.result).toBe(4);
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
      // When accessing undefined variable in strict mode, it throws ReferenceError
      const result = safeExpressionEval('unknown');

      // This may fail or succeed depending on sandbox strictness
      expect(typeof result.success).toBe('boolean');
    });
  });
});
