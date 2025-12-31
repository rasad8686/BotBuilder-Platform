/**
 * PluginValidator - Plugin validation and security checks
 * Validates plugin manifests, code, and security requirements
 */

const log = require('../../utils/logger');
const semver = require('semver');

class PluginValidator {
  constructor() {
    this.requiredManifestFields = ['name', 'version', 'description', 'type'];
    this.allowedTypes = ['tool', 'channel', 'ai', 'integration', 'theme', 'analytics'];
    this.maxNameLength = 50;
    this.maxDescriptionLength = 500;
    this.maxPermissions = 20;

    // Security patterns to detect
    this.dangerousPatterns = [
      { pattern: /eval\s*\(/gi, severity: 'critical', message: 'eval() is not allowed' },
      { pattern: /new\s+Function\s*\(/gi, severity: 'critical', message: 'new Function() is not allowed' },
      { pattern: /require\s*\(\s*['"`]child_process['"`]\s*\)/gi, severity: 'critical', message: 'child_process module not allowed' },
      { pattern: /require\s*\(\s*['"`]fs['"`]\s*\)/gi, severity: 'high', message: 'fs module not allowed in plugins' },
      { pattern: /process\s*\.\s*(exit|kill|abort)/gi, severity: 'critical', message: 'Process termination not allowed' },
      { pattern: /__proto__/gi, severity: 'high', message: '__proto__ access not allowed' },
      { pattern: /constructor\s*\[\s*['"`]constructor['"`]\s*\]/gi, severity: 'critical', message: 'Constructor hijacking not allowed' },
      { pattern: /require\s*\(\s*['"`]vm['"`]\s*\)/gi, severity: 'critical', message: 'vm module not allowed' },
      { pattern: /require\s*\(\s*['"`]cluster['"`]\s*\)/gi, severity: 'high', message: 'cluster module not allowed' },
      { pattern: /require\s*\(\s*['"`]worker_threads['"`]\s*\)/gi, severity: 'high', message: 'worker_threads not allowed' },
      { pattern: /globalThis/gi, severity: 'medium', message: 'globalThis access not recommended' },
      { pattern: /Reflect\s*\.\s*(setPrototypeOf|defineProperty)/gi, severity: 'high', message: 'Prototype manipulation not allowed' }
    ];

    // Allowed permissions
    this.validPermissions = [
      'read:data',
      'write:data',
      'read:messages',
      'send:messages',
      'network:outbound',
      'network:inbound',
      'storage:local',
      'storage:database',
      'agent:execute',
      'flow:read',
      'flow:modify',
      'user:read',
      'user:write',
      'analytics:read',
      'analytics:write',
      'webhook:create',
      'webhook:receive',
      'settings:read',
      'settings:write',
      'admin:settings'
    ];

    // High risk permissions
    this.highRiskPermissions = [
      'network:inbound',
      'storage:database',
      'user:write',
      'flow:modify',
      'admin:settings',
      'agent:execute'
    ];
  }

  /**
   * Validate a plugin manifest
   * @param {object} manifest - Plugin manifest
   * @returns {object} - Validation result
   */
  validateManifest(manifest) {
    const errors = [];
    const warnings = [];

    // Check required fields
    for (const field of this.requiredManifestFields) {
      if (!manifest[field]) {
        errors.push(`Missing required field: ${field}`);
      }
    }

    // Validate name
    if (manifest.name) {
      if (manifest.name.length > this.maxNameLength) {
        errors.push(`Name exceeds maximum length of ${this.maxNameLength} characters`);
      }
      if (!/^[a-zA-Z0-9-_\s]+$/.test(manifest.name)) {
        errors.push('Name contains invalid characters');
      }
    }

    // Validate version
    if (manifest.version) {
      if (!semver.valid(manifest.version)) {
        errors.push('Version must be a valid semver (e.g., 1.0.0)');
      }
    }

    // Validate type
    if (manifest.type && !this.allowedTypes.includes(manifest.type)) {
      errors.push(`Invalid type. Allowed types: ${this.allowedTypes.join(', ')}`);
    }

    // Validate description
    if (manifest.description && manifest.description.length > this.maxDescriptionLength) {
      warnings.push(`Description exceeds recommended length of ${this.maxDescriptionLength} characters`);
    }

    // Validate permissions
    if (manifest.permissions) {
      if (!Array.isArray(manifest.permissions)) {
        errors.push('Permissions must be an array');
      } else {
        if (manifest.permissions.length > this.maxPermissions) {
          errors.push(`Too many permissions. Maximum allowed: ${this.maxPermissions}`);
        }

        for (const perm of manifest.permissions) {
          if (!this.validPermissions.includes(perm)) {
            warnings.push(`Unknown permission: ${perm}`);
          }
          if (this.highRiskPermissions.includes(perm)) {
            warnings.push(`High-risk permission requested: ${perm}`);
          }
        }
      }
    }

    // Validate main entry
    if (manifest.main) {
      if (!manifest.main.endsWith('.js')) {
        warnings.push('Main entry should be a JavaScript file');
      }
    }

    // Validate config schema
    if (manifest.config) {
      const configValidation = this.validateConfigSchema(manifest.config);
      errors.push(...configValidation.errors);
      warnings.push(...configValidation.warnings);
    }

    // Validate dependencies
    if (manifest.dependencies) {
      const depValidation = this.validateDependencies(manifest.dependencies);
      errors.push(...depValidation.errors);
      warnings.push(...depValidation.warnings);
    }

    // Validate hooks
    if (manifest.hooks) {
      const hookValidation = this.validateHooks(manifest.hooks);
      errors.push(...hookValidation.errors);
      warnings.push(...hookValidation.warnings);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      riskLevel: this.calculateRiskLevel(manifest)
    };
  }

  /**
   * Validate config schema
   * @param {object} config - Config schema
   * @returns {object}
   */
  validateConfigSchema(config) {
    const errors = [];
    const warnings = [];

    if (typeof config !== 'object') {
      errors.push('Config must be an object');
      return { errors, warnings };
    }

    const validTypes = ['string', 'number', 'boolean', 'array', 'object', 'select'];

    for (const [key, schema] of Object.entries(config)) {
      if (!schema.type) {
        errors.push(`Config field '${key}' missing type`);
      } else if (!validTypes.includes(schema.type)) {
        errors.push(`Config field '${key}' has invalid type: ${schema.type}`);
      }

      if (schema.type === 'select' && !schema.options) {
        errors.push(`Config field '${key}' of type 'select' requires options`);
      }

      if (schema.required && schema.default === undefined) {
        warnings.push(`Required config field '${key}' has no default value`);
      }
    }

    return { errors, warnings };
  }

  /**
   * Validate dependencies
   * @param {object} dependencies - Dependencies object
   * @returns {object}
   */
  validateDependencies(dependencies) {
    const errors = [];
    const warnings = [];

    if (typeof dependencies !== 'object') {
      errors.push('Dependencies must be an object');
      return { errors, warnings };
    }

    for (const [name, version] of Object.entries(dependencies)) {
      if (typeof version !== 'string') {
        errors.push(`Dependency '${name}' version must be a string`);
        continue;
      }

      // Check for valid semver range
      if (!semver.validRange(version)) {
        warnings.push(`Dependency '${name}' has invalid version range: ${version}`);
      }
    }

    return { errors, warnings };
  }

  /**
   * Validate hooks
   * @param {object} hooks - Hooks configuration
   * @returns {object}
   */
  validateHooks(hooks) {
    const errors = [];
    const warnings = [];

    const validHooks = [
      'onInstall',
      'onUninstall',
      'onEnable',
      'onDisable',
      'onMessage',
      'onAgentExecute',
      'onFlowStart',
      'onFlowEnd',
      'onUserCreate',
      'onUserUpdate',
      'onWebhook',
      'onSchedule',
      'onSettingsChange'
    ];

    if (typeof hooks !== 'object') {
      errors.push('Hooks must be an object');
      return { errors, warnings };
    }

    for (const hookName of Object.keys(hooks)) {
      if (!validHooks.includes(hookName)) {
        warnings.push(`Unknown hook: ${hookName}`);
      }
    }

    return { errors, warnings };
  }

  /**
   * Validate plugin code
   * @param {string} code - Plugin code
   * @returns {object}
   */
  validateCode(code) {
    const errors = [];
    const warnings = [];
    const issues = [];

    if (!code || typeof code !== 'string') {
      errors.push('Code must be a non-empty string');
      return { valid: false, errors, warnings, issues };
    }

    // Check file size
    if (code.length > 1000000) { // 1MB
      errors.push('Code exceeds maximum size limit (1MB)');
    }

    // Check for dangerous patterns
    for (const { pattern, severity, message } of this.dangerousPatterns) {
      if (pattern.test(code)) {
        const issue = { severity, message, pattern: pattern.source };

        if (severity === 'critical') {
          errors.push(message);
        } else if (severity === 'high') {
          errors.push(message);
        } else {
          warnings.push(message);
        }

        issues.push(issue);
      }
    }

    // Check for common issues
    if (!/module\.exports\s*=/g.test(code) && !/export\s+(default|{)/g.test(code)) {
      warnings.push('Plugin does not appear to export anything');
    }

    // Check for infinite loops (basic detection)
    if (/while\s*\(\s*true\s*\)/.test(code) || /for\s*\(\s*;\s*;\s*\)/.test(code)) {
      warnings.push('Potential infinite loop detected');
    }

    // Check for blocking operations
    if (/\.readFileSync\s*\(/.test(code) || /\.writeFileSync\s*\(/.test(code)) {
      warnings.push('Synchronous file operations may block the event loop');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      issues,
      score: this.calculateSecurityScore(errors, warnings, issues)
    };
  }

  /**
   * Calculate security score (0-100)
   * @param {Array} errors
   * @param {Array} warnings
   * @param {Array} issues
   * @returns {number}
   */
  calculateSecurityScore(errors, warnings, issues) {
    let score = 100;

    // Deduct for errors
    score -= errors.length * 25;

    // Deduct for warnings
    score -= warnings.length * 5;

    // Deduct for issues by severity
    for (const issue of issues) {
      switch (issue.severity) {
        case 'critical':
          score -= 30;
          break;
        case 'high':
          score -= 20;
          break;
        case 'medium':
          score -= 10;
          break;
        case 'low':
          score -= 5;
          break;
      }
    }

    return Math.max(0, score);
  }

  /**
   * Calculate risk level for manifest
   * @param {object} manifest
   * @returns {string}
   */
  calculateRiskLevel(manifest) {
    const permissions = manifest.permissions || [];
    const highRiskCount = permissions.filter(p => this.highRiskPermissions.includes(p)).length;

    if (highRiskCount >= 3) return 'high';
    if (highRiskCount >= 1) return 'medium';
    if (permissions.length > 5) return 'medium';
    return 'low';
  }

  /**
   * Full validation of a plugin submission
   * @param {object} submission - Plugin submission
   * @returns {object}
   */
  async validateSubmission(submission) {
    const { manifest, code, assets } = submission;
    const results = {
      valid: true,
      errors: [],
      warnings: [],
      manifestValidation: null,
      codeValidation: null,
      assetsValidation: null
    };

    // Validate manifest
    if (manifest) {
      results.manifestValidation = this.validateManifest(manifest);
      if (!results.manifestValidation.valid) {
        results.valid = false;
        results.errors.push(...results.manifestValidation.errors);
      }
      results.warnings.push(...results.manifestValidation.warnings);
    } else {
      results.valid = false;
      results.errors.push('Manifest is required');
    }

    // Validate code
    if (code) {
      results.codeValidation = this.validateCode(code);
      if (!results.codeValidation.valid) {
        results.valid = false;
        results.errors.push(...results.codeValidation.errors);
      }
      results.warnings.push(...results.codeValidation.warnings);
    }

    // Validate assets
    if (assets) {
      results.assetsValidation = this.validateAssets(assets);
      results.errors.push(...results.assetsValidation.errors);
      results.warnings.push(...results.assetsValidation.warnings);
    }

    return results;
  }

  /**
   * Validate plugin assets
   * @param {object} assets - Assets object
   * @returns {object}
   */
  validateAssets(assets) {
    const errors = [];
    const warnings = [];

    const allowedExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.css', '.html'];
    const maxAssetSize = 5 * 1024 * 1024; // 5MB

    if (assets.icon) {
      if (assets.icon.size > maxAssetSize) {
        errors.push('Icon file too large (max 5MB)');
      }
    }

    if (assets.banner) {
      if (assets.banner.size > maxAssetSize) {
        errors.push('Banner file too large (max 5MB)');
      }
    }

    if (assets.files) {
      for (const file of assets.files) {
        const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
        if (!allowedExtensions.includes(ext)) {
          warnings.push(`Unsupported file type: ${file.name}`);
        }
        if (file.size > maxAssetSize) {
          errors.push(`File too large: ${file.name}`);
        }
      }
    }

    return { errors, warnings };
  }

  /**
   * Check if permission is high risk
   * @param {string} permission
   * @returns {boolean}
   */
  isHighRiskPermission(permission) {
    return this.highRiskPermissions.includes(permission);
  }

  /**
   * Get permission description
   * @param {string} permission
   * @returns {string}
   */
  getPermissionDescription(permission) {
    const descriptions = {
      'read:data': 'Read plugin data storage',
      'write:data': 'Write to plugin data storage',
      'read:messages': 'Read incoming messages',
      'send:messages': 'Send messages on behalf of bot',
      'network:outbound': 'Make HTTP requests to external services',
      'network:inbound': 'Receive incoming webhooks',
      'storage:local': 'Use local file storage',
      'storage:database': 'Access database directly',
      'agent:execute': 'Execute AI agent actions',
      'flow:read': 'Read conversation flows',
      'flow:modify': 'Modify conversation flows',
      'user:read': 'Read user information',
      'user:write': 'Modify user information',
      'analytics:read': 'Read analytics data',
      'analytics:write': 'Write analytics events',
      'webhook:create': 'Create webhooks',
      'webhook:receive': 'Receive webhook events',
      'settings:read': 'Read plugin settings',
      'settings:write': 'Modify plugin settings',
      'admin:settings': 'Access admin settings'
    };

    return descriptions[permission] || 'Unknown permission';
  }
}

module.exports = new PluginValidator();
