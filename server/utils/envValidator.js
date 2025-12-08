/**
 * Environment Variables Validator
 * Ensures all required environment variables are set before server starts
 *
 * This prevents the server from running with insecure fallback values
 */

const log = require('./logger');

// Required environment variables for production
const REQUIRED_ENV_VARS = {
  // Critical Security
  JWT_SECRET: {
    required: true,
    minLength: 32,
    description: 'JWT signing secret (min 32 characters)'
  },
  AI_ENCRYPTION_SECRET: {
    required: true,
    minLength: 32,
    description: 'Encryption key for API keys (min 32 characters)'
  },

  // Database
  DATABASE_URL: {
    required: true,
    description: 'PostgreSQL connection string'
  },

  // Admin Account (production only)
  ADMIN_EMAIL: {
    required: process.env.NODE_ENV === 'production',
    description: 'Admin email address'
  },
  ADMIN_PASSWORD: {
    required: process.env.NODE_ENV === 'production',
    minLength: 12,
    description: 'Admin password (min 12 characters)'
  }
};

// Optional but recommended variables
const RECOMMENDED_ENV_VARS = {
  // Stripe (for billing)
  STRIPE_SECRET_KEY: {
    description: 'Stripe API secret key'
  },
  STRIPE_WEBHOOK_SECRET: {
    description: 'Stripe webhook signing secret'
  },

  // Channel integrations
  WHATSAPP_VERIFY_TOKEN: {
    minLength: 16,
    description: 'WhatsApp webhook verification token'
  },
  WHATSAPP_APP_SECRET: {
    description: 'WhatsApp App Secret for signature verification'
  },
  INSTAGRAM_VERIFY_TOKEN: {
    minLength: 16,
    description: 'Instagram webhook verification token'
  },
  INSTAGRAM_APP_SECRET: {
    description: 'Instagram App Secret for signature verification'
  },

  // AI Providers
  OPENAI_API_KEY: {
    description: 'OpenAI API key'
  },
  ANTHROPIC_API_KEY: {
    description: 'Anthropic API key'
  }
};

/**
 * Validate a single environment variable
 */
function validateVar(name, config, value) {
  const errors = [];

  if (config.required && !value) {
    errors.push(`${name} is required but not set`);
    return errors;
  }

  if (value && config.minLength && value.length < config.minLength) {
    errors.push(`${name} must be at least ${config.minLength} characters (current: ${value.length})`);
  }

  // Check for insecure default values
  const insecureDefaults = [
    'your-super-secret-jwt-key-change-in-production',
    'default-encryption-key-change-in-production',
    'admin123',
    'password',
    'secret',
    'changeme',
    'botbuilder_whatsapp_webhook',
    'botbuilder_instagram_webhook'
  ];

  if (value && insecureDefaults.some(d => value.toLowerCase().includes(d.toLowerCase()))) {
    errors.push(`${name} contains an insecure default value - please change it`);
  }

  return errors;
}

/**
 * Validate all required environment variables
 * @returns {Object} { valid: boolean, errors: string[], warnings: string[] }
 */
function validateEnv() {
  const errors = [];
  const warnings = [];
  const isProduction = process.env.NODE_ENV === 'production';

  log.info('Validating environment variables...', { environment: process.env.NODE_ENV || 'development' });

  // Check required variables
  for (const [name, config] of Object.entries(REQUIRED_ENV_VARS)) {
    // Skip if required only in production and we're not in production
    if (config.required === false || (typeof config.required === 'boolean' && !config.required)) {
      continue;
    }

    const value = process.env[name];
    const varErrors = validateVar(name, config, value);
    errors.push(...varErrors);
  }

  // Check recommended variables (warnings only)
  for (const [name, config] of Object.entries(RECOMMENDED_ENV_VARS)) {
    const value = process.env[name];
    if (!value) {
      warnings.push(`${name} is not set - ${config.description}`);
    } else {
      const varErrors = validateVar(name, config, value);
      if (varErrors.length > 0) {
        warnings.push(...varErrors);
      }
    }
  }

  // Log results
  if (errors.length > 0) {
    log.error('Environment validation failed', {
      errorCount: errors.length,
      errors
    });
  }

  if (warnings.length > 0) {
    log.warn('Environment validation warnings', {
      warningCount: warnings.length,
      warnings
    });
  }

  if (errors.length === 0) {
    log.info('Environment validation passed', {
      checkedRequired: Object.keys(REQUIRED_ENV_VARS).length,
      checkedRecommended: Object.keys(RECOMMENDED_ENV_VARS).length,
      warningsCount: warnings.length
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate environment and exit if critical errors in production
 */
function validateEnvOrExit() {
  const result = validateEnv();
  const isProduction = process.env.NODE_ENV === 'production';

  if (!result.valid) {
    console.error('\n========================================');
    console.error('🚨 CRITICAL: Environment Validation Failed');
    console.error('========================================\n');
    console.error('The following required environment variables have issues:\n');
    result.errors.forEach((err, i) => {
      console.error(`  ${i + 1}. ${err}`);
    });
    console.error('\nPlease set these variables in your .env file or environment.');
    console.error('See .env.example for reference.\n');

    if (isProduction) {
      console.error('❌ Server will NOT start in production with invalid configuration.\n');
      process.exit(1);
    } else {
      console.error('⚠️  Running in development mode with insecure defaults.');
      console.error('   DO NOT use this configuration in production!\n');
    }
  }

  return result;
}

/**
 * Get secure value or throw in production
 */
function getSecureEnv(name, fallback = null) {
  const value = process.env[name];
  const isProduction = process.env.NODE_ENV === 'production';

  if (!value && isProduction && !fallback) {
    throw new Error(`Required environment variable ${name} is not set`);
  }

  return value || fallback;
}

module.exports = {
  validateEnv,
  validateEnvOrExit,
  getSecureEnv,
  REQUIRED_ENV_VARS,
  RECOMMENDED_ENV_VARS
};
