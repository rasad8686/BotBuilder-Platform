/**
 * SSO Service
 * Handles SSO configuration management, domain verification, and metadata generation
 */

const crypto = require('crypto');
const db = require('../db');
const EncryptionHelper = require('./ai/encryptionHelper');
const log = require('../utils/logger');

class SSOService {
  /**
   * Create a new SSO configuration
   * @param {number} orgId - Organization ID
   * @param {Object} data - SSO configuration data
   * @returns {Object} Created configuration
   */
  static async createSSOConfig(orgId, data) {
    try {
      // Check if organization already has SSO config
      const existingResult = await db.query(
        'SELECT id FROM sso_configurations WHERE organization_id = $1',
        [orgId]
      );

      if (existingResult.rows.length > 0) {
        throw new Error('Organization already has an SSO configuration');
      }

      // Encrypt sensitive fields
      const privateKeyEncrypted = data.private_key ? EncryptionHelper.encrypt(data.private_key) : null;
      const clientSecretEncrypted = data.client_secret ? EncryptionHelper.encrypt(data.client_secret) : null;

      const result = await db.query(
        `INSERT INTO sso_configurations (
          organization_id, provider_type, name, is_enabled, is_enforced, settings,
          metadata_url, entity_id, acs_url, certificate, private_key_encrypted,
          client_id, client_secret_encrypted, issuer_url, authorization_url,
          token_url, userinfo_url, jwks_url, scopes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
        RETURNING *`,
        [
          orgId,
          data.provider_type,
          data.name || `${data.provider_type.toUpperCase()} SSO`,
          data.is_enabled || false,
          data.is_enforced || false,
          JSON.stringify(data.settings || {}),
          data.metadata_url,
          data.entity_id,
          data.acs_url,
          data.certificate,
          privateKeyEncrypted,
          data.client_id,
          clientSecretEncrypted,
          data.issuer_url,
          data.authorization_url,
          data.token_url,
          data.userinfo_url,
          data.jwks_url,
          data.scopes || 'openid profile email'
        ]
      );

      log.info('SSO configuration created', { orgId, provider: data.provider_type });

      return this.sanitizeConfig(result.rows[0]);
    } catch (error) {
      log.error('Error creating SSO config:', { error: error.message, orgId });
      throw error;
    }
  }

  /**
   * Update SSO configuration
   * @param {number} configId - Configuration ID
   * @param {Object} data - Update data
   * @returns {Object} Updated configuration
   */
  static async updateSSOConfig(configId, data) {
    try {
      const updates = [];
      const values = [];
      let paramIndex = 1;

      // Build dynamic update query
      const allowedFields = [
        'name', 'is_enabled', 'is_enforced', 'metadata_url', 'entity_id',
        'acs_url', 'certificate', 'client_id', 'issuer_url', 'authorization_url',
        'token_url', 'userinfo_url', 'jwks_url', 'scopes'
      ];

      allowedFields.forEach(field => {
        if (data[field] !== undefined) {
          updates.push(`${field} = $${paramIndex}`);
          values.push(data[field]);
          paramIndex++;
        }
      });

      // Handle settings
      if (data.settings) {
        updates.push(`settings = $${paramIndex}`);
        values.push(JSON.stringify(data.settings));
        paramIndex++;
      }

      // Handle encrypted fields
      if (data.private_key) {
        updates.push(`private_key_encrypted = $${paramIndex}`);
        values.push(EncryptionHelper.encrypt(data.private_key));
        paramIndex++;
      }
      if (data.client_secret) {
        updates.push(`client_secret_encrypted = $${paramIndex}`);
        values.push(EncryptionHelper.encrypt(data.client_secret));
        paramIndex++;
      }

      updates.push(`updated_at = NOW()`);

      values.push(configId);

      const result = await db.query(
        `UPDATE sso_configurations SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        throw new Error('SSO configuration not found');
      }

      log.info('SSO configuration updated', { configId });

      return this.sanitizeConfig(result.rows[0]);
    } catch (error) {
      log.error('Error updating SSO config:', { error: error.message, configId });
      throw error;
    }
  }

  /**
   * Delete SSO configuration
   * @param {number} configId - Configuration ID
   */
  static async deleteSSOConfig(configId) {
    try {
      const result = await db.query(
        'DELETE FROM sso_configurations WHERE id = $1',
        [configId]
      );

      if (result.rowCount === 0) {
        throw new Error('SSO configuration not found');
      }

      log.info('SSO configuration deleted', { configId });

      return { success: true };
    } catch (error) {
      log.error('Error deleting SSO config:', { error: error.message, configId });
      throw error;
    }
  }

  /**
   * Get SSO configuration by organization ID
   * @param {number} orgId - Organization ID
   * @returns {Object|null} SSO configuration
   */
  static async getSSOConfigByOrg(orgId) {
    try {
      const configResult = await db.query(
        'SELECT * FROM sso_configurations WHERE organization_id = $1',
        [orgId]
      );

      if (configResult.rows.length === 0) {
        return null;
      }

      const config = configResult.rows[0];

      // Get domains
      const domainsResult = await db.query(
        'SELECT * FROM sso_domains WHERE sso_configuration_id = $1',
        [config.id]
      );

      return {
        ...this.sanitizeConfig(config),
        domains: domainsResult.rows
      };
    } catch (error) {
      log.error('Error getting SSO config by org:', { error: error.message, orgId });
      throw error;
    }
  }

  /**
   * Get SSO configuration by domain
   * @param {string} domain - Email domain (e.g., "company.com")
   * @returns {Object|null} SSO configuration
   */
  static async getSSOConfigByDomain(domain) {
    try {
      const normalizedDomain = domain.toLowerCase().trim();

      const domainResult = await db.query(
        'SELECT * FROM sso_domains WHERE domain = $1 AND is_verified = true',
        [normalizedDomain]
      );

      if (domainResult.rows.length === 0) {
        return null;
      }

      const ssoDomain = domainResult.rows[0];

      const configResult = await db.query(
        'SELECT * FROM sso_configurations WHERE id = $1 AND is_enabled = true',
        [ssoDomain.sso_configuration_id]
      );

      if (configResult.rows.length === 0) {
        return null;
      }

      return this.sanitizeConfig(configResult.rows[0]);
    } catch (error) {
      log.error('Error getting SSO config by domain:', { error: error.message, domain });
      throw error;
    }
  }

  /**
   * Check if email requires SSO
   * @param {string} email - User email
   * @returns {Object} { requiresSSO, config }
   */
  static async checkEmailSSO(email) {
    try {
      const domain = email.split('@')[1]?.toLowerCase();

      if (!domain) {
        return { requiresSSO: false, config: null };
      }

      const config = await this.getSSOConfigByDomain(domain);

      if (!config) {
        return { requiresSSO: false, config: null };
      }

      return {
        requiresSSO: config.is_enforced,
        ssoAvailable: true,
        config: {
          id: config.id,
          provider_type: config.provider_type,
          name: config.name,
          is_enforced: config.is_enforced
        }
      };
    } catch (error) {
      log.error('Error checking email SSO:', { error: error.message, email });
      return { requiresSSO: false, config: null };
    }
  }

  /**
   * Add domain to SSO configuration
   * @param {number} configId - Configuration ID
   * @param {string} domain - Domain to add
   * @returns {Object} Created domain
   */
  static async addDomain(configId, domain) {
    try {
      const normalizedDomain = domain.toLowerCase().trim();

      // Check if domain already exists
      const existingResult = await db.query(
        'SELECT id FROM sso_domains WHERE domain = $1',
        [normalizedDomain]
      );

      if (existingResult.rows.length > 0) {
        throw new Error('Domain is already registered');
      }

      // Generate verification token
      const verificationToken = crypto.randomBytes(32).toString('hex');

      const result = await db.query(
        `INSERT INTO sso_domains (sso_configuration_id, domain, verification_token, is_verified)
         VALUES ($1, $2, $3, false) RETURNING *`,
        [configId, normalizedDomain, verificationToken]
      );

      log.info('SSO domain added', { configId, domain: normalizedDomain });

      return result.rows[0];
    } catch (error) {
      log.error('Error adding SSO domain:', { error: error.message, configId, domain });
      throw error;
    }
  }

  /**
   * Verify SSO domain via DNS TXT record
   * @param {number} configId - Configuration ID
   * @param {number} domainId - Domain ID
   * @returns {Object} Verification result
   */
  static async verifySSODomain(configId, domainId) {
    try {
      const domainResult = await db.query(
        'SELECT * FROM sso_domains WHERE id = $1 AND sso_configuration_id = $2',
        [domainId, configId]
      );

      if (domainResult.rows.length === 0) {
        throw new Error('Domain not found');
      }

      const ssoDomain = domainResult.rows[0];

      if (ssoDomain.is_verified) {
        return { success: true, message: 'Domain already verified' };
      }

      // In production, this would check DNS TXT record
      const dns = require('dns').promises;

      try {
        const records = await dns.resolveTxt(`_sso-verify.${ssoDomain.domain}`);
        const flatRecords = records.flat();

        const isValid = flatRecords.some(record =>
          record.includes(ssoDomain.verification_token)
        );

        if (isValid) {
          await db.query(
            'UPDATE sso_domains SET is_verified = true, verified_at = NOW() WHERE id = $1',
            [domainId]
          );

          log.info('SSO domain verified', { domainId, domain: ssoDomain.domain });

          return { success: true, message: 'Domain verified successfully' };
        } else {
          return {
            success: false,
            message: 'DNS TXT record not found or invalid',
            expectedRecord: `_sso-verify.${ssoDomain.domain} TXT "${ssoDomain.verification_token}"`
          };
        }
      } catch (dnsError) {
        return {
          success: false,
          message: 'Could not verify DNS record',
          instructions: {
            recordType: 'TXT',
            hostname: `_sso-verify.${ssoDomain.domain}`,
            value: ssoDomain.verification_token
          }
        };
      }
    } catch (error) {
      log.error('Error verifying SSO domain:', { error: error.message, configId, domainId });
      throw error;
    }
  }

  /**
   * Delete SSO domain
   * @param {number} configId - Configuration ID
   * @param {number} domainId - Domain ID
   */
  static async deleteDomain(configId, domainId) {
    try {
      const result = await db.query(
        'DELETE FROM sso_domains WHERE id = $1 AND sso_configuration_id = $2',
        [domainId, configId]
      );

      if (result.rowCount === 0) {
        throw new Error('Domain not found');
      }

      log.info('SSO domain deleted', { configId, domainId });

      return { success: true };
    } catch (error) {
      log.error('Error deleting SSO domain:', { error: error.message, configId, domainId });
      throw error;
    }
  }

  /**
   * Generate SAML Service Provider Metadata
   * @param {number} configId - Configuration ID
   * @returns {string} XML Metadata
   */
  static async generateSAMLMetadata(configId) {
    try {
      const result = await db.query(
        'SELECT * FROM sso_configurations WHERE id = $1',
        [configId]
      );

      if (result.rows.length === 0) {
        throw new Error('SSO configuration not found');
      }

      const config = result.rows[0];

      const baseUrl = process.env.APP_URL || 'http://localhost:3000';
      const entityId = config.entity_id || `${baseUrl}/api/sso/saml/metadata`;
      const acsUrl = config.acs_url || `${baseUrl}/api/sso/saml/acs`;

      const metadata = `<?xml version="1.0" encoding="UTF-8"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${entityId}">
  <md:SPSSODescriptor AuthnRequestsSigned="false" WantAssertionsSigned="true" protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <md:NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</md:NameIDFormat>
    <md:AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="${acsUrl}" index="1"/>
  </md:SPSSODescriptor>
</md:EntityDescriptor>`;

      return metadata;
    } catch (error) {
      log.error('Error generating SAML metadata:', { error: error.message, configId });
      throw error;
    }
  }

  /**
   * Test SSO connection
   * @param {number} configId - Configuration ID
   * @returns {Object} Test result
   */
  static async testSSOConnection(configId) {
    try {
      const result = await db.query(
        'SELECT * FROM sso_configurations WHERE id = $1',
        [configId]
      );

      if (result.rows.length === 0) {
        throw new Error('SSO configuration not found');
      }

      const config = result.rows[0];

      const results = {
        success: true,
        checks: []
      };

      if (config.provider_type === 'saml' || config.provider_type === 'azure_ad' || config.provider_type === 'okta') {
        // Test SAML configuration
        if (config.metadata_url) {
          try {
            const https = require('https');
            const http = require('http');
            const url = new URL(config.metadata_url);
            const protocol = url.protocol === 'https:' ? https : http;

            await new Promise((resolve, reject) => {
              const req = protocol.get(config.metadata_url, { timeout: 10000 }, (res) => {
                if (res.statusCode === 200) {
                  results.checks.push({ name: 'Metadata URL', status: 'success', message: 'Accessible' });
                  resolve();
                } else {
                  results.checks.push({ name: 'Metadata URL', status: 'warning', message: `HTTP ${res.statusCode}` });
                  resolve();
                }
              });
              req.on('error', (e) => {
                results.checks.push({ name: 'Metadata URL', status: 'error', message: e.message });
                resolve();
              });
              req.on('timeout', () => {
                results.checks.push({ name: 'Metadata URL', status: 'error', message: 'Timeout' });
                req.destroy();
                resolve();
              });
            });
          } catch (e) {
            results.checks.push({ name: 'Metadata URL', status: 'error', message: 'Invalid URL' });
          }
        }

        if (config.certificate) {
          results.checks.push({ name: 'Certificate', status: 'success', message: 'Configured' });
        } else {
          results.checks.push({ name: 'Certificate', status: 'warning', message: 'Not configured' });
        }

        if (config.entity_id) {
          results.checks.push({ name: 'Entity ID', status: 'success', message: 'Configured' });
        } else {
          results.checks.push({ name: 'Entity ID', status: 'error', message: 'Not configured' });
          results.success = false;
        }
      }

      if (config.provider_type === 'oidc' || config.provider_type === 'google') {
        // Test OIDC configuration
        if (config.client_id) {
          results.checks.push({ name: 'Client ID', status: 'success', message: 'Configured' });
        } else {
          results.checks.push({ name: 'Client ID', status: 'error', message: 'Not configured' });
          results.success = false;
        }

        if (config.client_secret_encrypted) {
          results.checks.push({ name: 'Client Secret', status: 'success', message: 'Configured' });
        } else {
          results.checks.push({ name: 'Client Secret', status: 'error', message: 'Not configured' });
          results.success = false;
        }

        if (config.issuer_url) {
          try {
            const https = require('https');
            const wellKnownUrl = `${config.issuer_url}/.well-known/openid-configuration`;

            await new Promise((resolve) => {
              https.get(wellKnownUrl, { timeout: 10000 }, (res) => {
                if (res.statusCode === 200) {
                  results.checks.push({ name: 'OIDC Discovery', status: 'success', message: 'Accessible' });
                } else {
                  results.checks.push({ name: 'OIDC Discovery', status: 'warning', message: `HTTP ${res.statusCode}` });
                }
                resolve();
              }).on('error', (e) => {
                results.checks.push({ name: 'OIDC Discovery', status: 'error', message: e.message });
                resolve();
              });
            });
          } catch (e) {
            results.checks.push({ name: 'OIDC Discovery', status: 'error', message: 'Invalid issuer URL' });
          }
        }
      }

      // Check domains
      const domainsResult = await db.query(
        'SELECT * FROM sso_domains WHERE sso_configuration_id = $1',
        [configId]
      );

      const domains = domainsResult.rows;
      const verifiedDomains = domains.filter(d => d.is_verified);

      if (verifiedDomains.length > 0) {
        results.checks.push({
          name: 'Domains',
          status: 'success',
          message: `${verifiedDomains.length} verified domain(s)`
        });
      } else if (domains.length > 0) {
        results.checks.push({
          name: 'Domains',
          status: 'warning',
          message: 'No verified domains'
        });
      } else {
        results.checks.push({
          name: 'Domains',
          status: 'error',
          message: 'No domains configured'
        });
        results.success = false;
      }

      return results;
    } catch (error) {
      log.error('Error testing SSO connection:', { error: error.message, configId });
      throw error;
    }
  }

  /**
   * Log SSO login attempt
   * @param {Object} data - Log data
   * @returns {Object} Created log entry
   */
  static async logLoginAttempt(data) {
    try {
      const result = await db.query(
        `INSERT INTO sso_login_logs (sso_configuration_id, user_id, email, status, error_message, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [data.configId, data.userId, data.email, data.status, data.errorMessage, data.ipAddress, data.userAgent]
      );

      return result.rows[0];
    } catch (error) {
      log.error('Error logging SSO attempt:', { error: error.message });
      // Don't throw - logging should not break the flow
      return null;
    }
  }

  /**
   * Get SSO login logs
   * @param {number} configId - Configuration ID
   * @param {Object} options - Query options
   * @returns {Object} Logs with pagination
   */
  static async getLoginLogs(configId, options = {}) {
    try {
      const { page = 1, limit = 50 } = options;
      const offset = (page - 1) * limit;

      const [logsResult, countResult] = await Promise.all([
        db.query(
          'SELECT * FROM sso_login_logs WHERE sso_configuration_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
          [configId, limit, offset]
        ),
        db.query(
          'SELECT COUNT(*) as count FROM sso_login_logs WHERE sso_configuration_id = $1',
          [configId]
        )
      ]);

      const total = parseInt(countResult.rows[0].count);

      return {
        logs: logsResult.rows,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      log.error('Error getting SSO login logs:', { error: error.message, configId });
      throw error;
    }
  }

  /**
   * Create or update user mapping
   * @param {Object} data - Mapping data
   * @returns {Object} User mapping
   */
  static async upsertUserMapping(data) {
    try {
      const existingResult = await db.query(
        'SELECT * FROM sso_user_mappings WHERE sso_configuration_id = $1 AND external_id = $2',
        [data.configId, data.externalId]
      );

      if (existingResult.rows.length > 0) {
        const result = await db.query(
          `UPDATE sso_user_mappings
           SET user_id = $1, email = $2, attributes = $3, last_login_at = NOW(), updated_at = NOW()
           WHERE id = $4 RETURNING *`,
          [data.userId, data.email, JSON.stringify(data.attributes || {}), existingResult.rows[0].id]
        );

        return result.rows[0];
      } else {
        const result = await db.query(
          `INSERT INTO sso_user_mappings (sso_configuration_id, user_id, external_id, email, attributes, last_login_at)
           VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *`,
          [data.configId, data.userId, data.externalId, data.email, JSON.stringify(data.attributes || {})]
        );

        return result.rows[0];
      }
    } catch (error) {
      log.error('Error upserting user mapping:', { error: error.message });
      throw error;
    }
  }

  /**
   * Get user mapping by external ID
   * @param {number} configId - Configuration ID
   * @param {string} externalId - External user ID
   * @returns {Object|null} User mapping
   */
  static async getUserMappingByExternalId(configId, externalId) {
    try {
      const result = await db.query(
        'SELECT * FROM sso_user_mappings WHERE sso_configuration_id = $1 AND external_id = $2',
        [configId, externalId]
      );

      return result.rows[0] || null;
    } catch (error) {
      log.error('Error getting user mapping:', { error: error.message });
      throw error;
    }
  }

  /**
   * Remove sensitive fields from config
   * @param {Object} config - Raw config from DB
   * @returns {Object} Sanitized config
   */
  static sanitizeConfig(config) {
    if (!config) return null;

    const sanitized = { ...config };

    // Parse JSON fields
    if (typeof sanitized.settings === 'string') {
      try {
        sanitized.settings = JSON.parse(sanitized.settings);
      } catch (e) {
        sanitized.settings = {};
      }
    }

    // Remove encrypted fields from output
    delete sanitized.private_key_encrypted;
    delete sanitized.client_secret_encrypted;

    // Add masked indicators
    sanitized.has_private_key = !!config.private_key_encrypted;
    sanitized.has_client_secret = !!config.client_secret_encrypted;

    return sanitized;
  }

  /**
   * Get decrypted config for internal use
   * @param {number} configId - Configuration ID
   * @returns {Object} Full config with decrypted secrets
   */
  static async getFullConfig(configId) {
    try {
      const result = await db.query(
        'SELECT * FROM sso_configurations WHERE id = $1',
        [configId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const config = result.rows[0];

      // Decrypt sensitive fields
      if (config.private_key_encrypted) {
        config.private_key = EncryptionHelper.decrypt(config.private_key_encrypted);
      }
      if (config.client_secret_encrypted) {
        config.client_secret = EncryptionHelper.decrypt(config.client_secret_encrypted);
      }

      // Parse JSON fields
      if (typeof config.settings === 'string') {
        try {
          config.settings = JSON.parse(config.settings);
        } catch (e) {
          config.settings = {};
        }
      }

      return config;
    } catch (error) {
      log.error('Error getting full SSO config:', { error: error.message, configId });
      throw error;
    }
  }
}

module.exports = SSOService;
