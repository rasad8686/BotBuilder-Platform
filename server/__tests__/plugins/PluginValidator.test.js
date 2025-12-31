/**
 * PluginValidator Tests
 */

const PluginValidator = require('../../plugins/core/PluginValidator');

describe('PluginValidator', () => {
  describe('validateManifest', () => {
    it('should validate a valid manifest', () => {
      const manifest = {
        name: 'test-plugin',
        version: '1.0.0',
        description: 'A test plugin',
        type: 'tool'
      };

      const result = PluginValidator.validateManifest(manifest);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail for missing required fields', () => {
      const manifest = {
        name: 'test-plugin'
      };

      const result = PluginValidator.validateManifest(manifest);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field: version');
      expect(result.errors).toContain('Missing required field: description');
      expect(result.errors).toContain('Missing required field: type');
    });

    it('should fail for name exceeding max length', () => {
      const manifest = {
        name: 'a'.repeat(60),
        version: '1.0.0',
        description: 'Test',
        type: 'tool'
      };

      const result = PluginValidator.validateManifest(manifest);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Name exceeds maximum length of 50 characters');
    });

    it('should fail for invalid version format', () => {
      const manifest = {
        name: 'test-plugin',
        version: 'invalid',
        description: 'Test',
        type: 'tool'
      };

      const result = PluginValidator.validateManifest(manifest);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Version must be a valid semver (e.g., 1.0.0)');
    });

    it('should fail for invalid type', () => {
      const manifest = {
        name: 'test-plugin',
        version: '1.0.0',
        description: 'Test',
        type: 'invalid-type'
      };

      const result = PluginValidator.validateManifest(manifest);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Invalid type');
    });

    it('should validate permissions array', () => {
      const manifest = {
        name: 'test-plugin',
        version: '1.0.0',
        description: 'Test',
        type: 'tool',
        permissions: ['read:data', 'write:data']
      };

      const result = PluginValidator.validateManifest(manifest);

      expect(result.valid).toBe(true);
    });

    it('should warn for unknown permissions', () => {
      const manifest = {
        name: 'test-plugin',
        version: '1.0.0',
        description: 'Test',
        type: 'tool',
        permissions: ['unknown:permission']
      };

      const result = PluginValidator.validateManifest(manifest);

      expect(result.warnings).toContain('Unknown permission: unknown:permission');
    });

    it('should warn for high-risk permissions', () => {
      const manifest = {
        name: 'test-plugin',
        version: '1.0.0',
        description: 'Test',
        type: 'tool',
        permissions: ['admin:settings']
      };

      const result = PluginValidator.validateManifest(manifest);

      expect(result.warnings).toContain('High-risk permission requested: admin:settings');
    });

    it('should calculate risk level correctly', () => {
      const lowRisk = {
        name: 'test',
        version: '1.0.0',
        description: 'Test',
        type: 'tool',
        permissions: ['read:data']
      };

      const highRisk = {
        name: 'test',
        version: '1.0.0',
        description: 'Test',
        type: 'tool',
        permissions: ['admin:settings', 'user:write', 'storage:database']
      };

      expect(PluginValidator.validateManifest(lowRisk).riskLevel).toBe('low');
      expect(PluginValidator.validateManifest(highRisk).riskLevel).toBe('high');
    });
  });

  describe('validateCode', () => {
    it('should validate safe code', () => {
      const code = `
        class MyPlugin {
          async execute(context) {
            return { success: true };
          }
        }
        module.exports = MyPlugin;
      `;

      const result = PluginValidator.validateCode(code);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect eval usage', () => {
      const code = `
        const result = eval("1 + 1");
      `;

      const result = PluginValidator.validateCode(code);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('eval() not allowed');
    });

    it('should detect new Function usage', () => {
      const code = `
        const fn = new Function("return 1 + 1");
      `;

      const result = PluginValidator.validateCode(code);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('new Function() not allowed');
    });

    it('should detect child_process require', () => {
      const code = `
        const cp = require('child_process');
      `;

      const result = PluginValidator.validateCode(code);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('child_process module not allowed');
    });

    it('should detect fs require', () => {
      const code = `
        const fs = require('fs');
      `;

      const result = PluginValidator.validateCode(code);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('fs module not allowed in plugins');
    });

    it('should detect __proto__ access', () => {
      const code = `
        const proto = obj.__proto__;
      `;

      const result = PluginValidator.validateCode(code);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('__proto__ access not allowed');
    });

    it('should warn for missing exports', () => {
      const code = `
        function doSomething() {
          return true;
        }
      `;

      const result = PluginValidator.validateCode(code);

      expect(result.warnings).toContain('Plugin does not appear to export anything');
    });

    it('should calculate security score', () => {
      const safeCode = `
        module.exports = { run: () => true };
      `;

      const unsafeCode = `
        eval("test");
        module.exports = {};
      `;

      const safeResult = PluginValidator.validateCode(safeCode);
      const unsafeResult = PluginValidator.validateCode(unsafeCode);

      expect(safeResult.score).toBeGreaterThan(unsafeResult.score);
    });
  });

  describe('validateConfigSchema', () => {
    it('should validate valid config schema', () => {
      const config = {
        apiKey: {
          type: 'string',
          required: true,
          description: 'API Key'
        },
        maxRetries: {
          type: 'number',
          default: 3
        }
      };

      const result = PluginValidator.validateConfigSchema(config);

      expect(result.errors).toHaveLength(0);
    });

    it('should fail for missing type', () => {
      const config = {
        apiKey: {
          required: true
        }
      };

      const result = PluginValidator.validateConfigSchema(config);

      expect(result.errors).toContain("Config field 'apiKey' missing type");
    });

    it('should fail for select without options', () => {
      const config = {
        mode: {
          type: 'select'
        }
      };

      const result = PluginValidator.validateConfigSchema(config);

      expect(result.errors).toContain("Config field 'mode' of type 'select' requires options");
    });
  });

  describe('isHighRiskPermission', () => {
    it('should identify high-risk permissions', () => {
      expect(PluginValidator.isHighRiskPermission('admin:settings')).toBe(true);
      expect(PluginValidator.isHighRiskPermission('user:write')).toBe(true);
      expect(PluginValidator.isHighRiskPermission('storage:database')).toBe(true);
    });

    it('should identify low-risk permissions', () => {
      expect(PluginValidator.isHighRiskPermission('read:data')).toBe(false);
      expect(PluginValidator.isHighRiskPermission('analytics:read')).toBe(false);
    });
  });

  describe('getPermissionDescription', () => {
    it('should return descriptions for known permissions', () => {
      expect(PluginValidator.getPermissionDescription('read:data')).toBe('Read plugin data storage');
      expect(PluginValidator.getPermissionDescription('network:outbound')).toBe('Make HTTP requests to external services');
    });

    it('should return default for unknown permissions', () => {
      expect(PluginValidator.getPermissionDescription('unknown')).toBe('Unknown permission');
    });
  });
});
