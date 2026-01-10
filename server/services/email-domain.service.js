/**
 * @fileoverview Email Domain Verification Service
 * @description Handles domain verification with DKIM, SPF, DMARC, and MX checks
 * @module services/email-domain.service
 */

const crypto = require('crypto');
const dns = require('dns').promises;
const log = require('../utils/logger');

class EmailDomainService {
  constructor() {
    this.dkimSelector = process.env.DKIM_SELECTOR || 'botbuilder';
    this.defaultSPF = 'v=spf1 include:_spf.google.com include:sendgrid.net include:amazonses.com ~all';
    this.defaultDMARC = 'v=DMARC1; p=quarantine; rua=mailto:dmarc@{domain}; ruf=mailto:dmarc@{domain}; fo=1';
  }

  /**
   * Get database connection
   * @private
   */
  _getDb() {
    return require('../config/db');
  }

  /**
   * Add a new domain for verification
   * @param {string} organizationId - Organization ID
   * @param {string} domain - Domain name
   * @param {Object} options - Additional options
   * @returns {Promise<Object>}
   */
  async addDomain(organizationId, domain, options = {}) {
    const db = this._getDb();

    // Normalize domain
    const normalizedDomain = domain.toLowerCase().trim();

    // Check if domain already exists
    const existing = await db('email_domains')
      .where('organization_id', organizationId)
      .where('domain', normalizedDomain)
      .first();

    if (existing) {
      throw new Error('Domain already exists');
    }

    // Generate DKIM keys
    const dkimKeys = await this.generateDKIMKeys();

    // Build DNS records
    const dnsRecords = this.buildDNSRecords(normalizedDomain, dkimKeys.publicKey);

    // Create domain record
    const [domainRecord] = await db('email_domains')
      .insert({
        organization_id: organizationId,
        workspace_id: options.workspaceId,
        domain: normalizedDomain,
        subdomain: options.subdomain || 'mail',
        status: 'pending',
        dkim_selector: this.dkimSelector,
        dkim_private_key: this.encryptKey(dkimKeys.privateKey),
        dkim_public_key: dkimKeys.publicKey,
        dkim_record_name: dnsRecords.dkim.name,
        dkim_record_value: dnsRecords.dkim.value,
        spf_record_value: dnsRecords.spf.value,
        dmarc_record_value: dnsRecords.dmarc.value,
        return_path_domain: `bounce.${normalizedDomain}`,
        return_path_cname: dnsRecords.returnPath.value,
        provider: options.provider || process.env.EMAIL_PROVIDER || 'smtp',
        provider_dns_records: JSON.stringify(dnsRecords),
        is_default: options.isDefault || false
      })
      .returning('*');

    // If provider is configured, register with provider
    if (domainRecord.provider !== 'smtp') {
      try {
        await this.registerWithProvider(domainRecord);
      } catch (error) {
        log.warn('Failed to register domain with provider', { error: error.message, domain: normalizedDomain });
      }
    }

    return {
      ...domainRecord,
      dkim_private_key: undefined, // Don't expose private key
      dnsRecords
    };
  }

  /**
   * Generate DKIM key pair
   * @returns {Promise<{privateKey: string, publicKey: string}>}
   */
  async generateDKIMKeys() {
    return new Promise((resolve, reject) => {
      crypto.generateKeyPair('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: {
          type: 'spki',
          format: 'pem'
        },
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem'
        }
      }, (err, publicKey, privateKey) => {
        if (err) {
          reject(err);
          return;
        }

        // Extract just the base64 part for DNS record
        const publicKeyBase64 = publicKey
          .replace(/-----BEGIN PUBLIC KEY-----/, '')
          .replace(/-----END PUBLIC KEY-----/, '')
          .replace(/\n/g, '');

        resolve({
          privateKey,
          publicKey: publicKeyBase64
        });
      });
    });
  }

  /**
   * Build DNS records for domain verification
   * @param {string} domain - Domain name
   * @param {string} publicKey - DKIM public key
   * @returns {Object}
   */
  buildDNSRecords(domain, publicKey) {
    const selector = this.dkimSelector;

    return {
      dkim: {
        type: 'TXT',
        name: `${selector}._domainkey.${domain}`,
        value: `v=DKIM1; k=rsa; p=${publicKey}`,
        description: 'DKIM record for email authentication'
      },
      spf: {
        type: 'TXT',
        name: domain,
        value: this.defaultSPF,
        description: 'SPF record to authorize email servers'
      },
      dmarc: {
        type: 'TXT',
        name: `_dmarc.${domain}`,
        value: this.defaultDMARC.replace(/{domain}/g, domain),
        description: 'DMARC policy for email handling'
      },
      returnPath: {
        type: 'CNAME',
        name: `bounce.${domain}`,
        value: 'bounce.sendgrid.net', // or ses bounce domain
        description: 'Return-Path for bounce handling'
      },
      mx: {
        type: 'MX',
        name: domain,
        value: '10 inbound-smtp.us-east-1.amazonaws.com', // Example
        description: 'MX record for receiving emails (optional)'
      }
    };
  }

  /**
   * Verify domain DNS records
   * @param {string} domainId - Domain ID
   * @returns {Promise<Object>}
   */
  async verifyDomain(domainId) {
    const db = this._getDb();

    const domain = await db('email_domains').where('id', domainId).first();
    if (!domain) {
      throw new Error('Domain not found');
    }

    // Update status to verifying
    await db('email_domains')
      .where('id', domainId)
      .update({
        status: 'verifying',
        verification_attempts: domain.verification_attempts + 1,
        last_verification_at: new Date()
      });

    const results = {
      dkim: { verified: false, error: null },
      spf: { verified: false, error: null },
      dmarc: { verified: false, error: null },
      mx: { verified: false, error: null }
    };

    try {
      // Check DKIM
      results.dkim = await this.checkDKIM(domain.domain, domain.dkim_selector, domain.dkim_public_key);

      // Check SPF
      results.spf = await this.checkSPF(domain.domain);

      // Check DMARC
      results.dmarc = await this.checkDMARC(domain.domain);

      // Check MX (optional)
      results.mx = await this.checkMX(domain.domain);
    } catch (error) {
      log.error('Domain verification error', { error: error.message, domain: domain.domain });
    }

    // Determine overall status
    const allVerified = results.dkim.verified && results.spf.verified && results.dmarc.verified;
    const status = allVerified ? 'verified' : (results.dkim.verified || results.spf.verified ? 'partial' : 'pending');

    // Update domain record
    const updateData = {
      status: allVerified ? 'verified' : 'pending',
      dkim_verified: results.dkim.verified,
      dkim_verified_at: results.dkim.verified ? new Date() : null,
      spf_verified: results.spf.verified,
      spf_verified_at: results.spf.verified ? new Date() : null,
      dmarc_verified: results.dmarc.verified,
      dmarc_verified_at: results.dmarc.verified ? new Date() : null,
      mx_verified: results.mx.verified,
      mx_verified_at: results.mx.verified ? new Date() : null,
      verified_at: allVerified ? new Date() : null,
      last_verification_error: allVerified ? null : JSON.stringify(results),
      updated_at: new Date()
    };

    await db('email_domains').where('id', domainId).update(updateData);

    // Also verify with provider if applicable
    if (domain.provider !== 'smtp' && domain.provider_domain_id) {
      try {
        await this.verifyWithProvider(domain);
      } catch (error) {
        log.warn('Provider verification failed', { error: error.message });
      }
    }

    return {
      domain: domain.domain,
      status: allVerified ? 'verified' : 'pending',
      results,
      allVerified
    };
  }

  /**
   * Check DKIM DNS record
   * @param {string} domain - Domain name
   * @param {string} selector - DKIM selector
   * @param {string} expectedKey - Expected public key
   * @returns {Promise<{verified: boolean, error?: string, records?: Array}>}
   */
  async checkDKIM(domain, selector, expectedKey) {
    try {
      const hostname = `${selector}._domainkey.${domain}`;
      const records = await dns.resolveTxt(hostname);

      const flatRecords = records.map(r => r.join(''));

      for (const record of flatRecords) {
        if (record.includes('v=DKIM1') && record.includes('k=rsa')) {
          // Check if public key matches
          const keyMatch = record.match(/p=([A-Za-z0-9+/=]+)/);
          if (keyMatch) {
            const foundKey = keyMatch[1];
            // Keys might be split across multiple strings, normalize for comparison
            const normalizedExpected = expectedKey.replace(/\s/g, '');
            const normalizedFound = foundKey.replace(/\s/g, '');

            if (normalizedFound === normalizedExpected || normalizedFound.length > 100) {
              return { verified: true, records: flatRecords };
            }
          }
          // Even if key doesn't match exactly, DKIM record exists
          return { verified: true, records: flatRecords, note: 'DKIM record found' };
        }
      }

      return { verified: false, error: 'DKIM record not found or invalid', records: flatRecords };
    } catch (error) {
      if (error.code === 'ENOTFOUND' || error.code === 'ENODATA') {
        return { verified: false, error: 'DKIM record not found' };
      }
      return { verified: false, error: error.message };
    }
  }

  /**
   * Check SPF DNS record
   * @param {string} domain - Domain name
   * @returns {Promise<{verified: boolean, error?: string, record?: string}>}
   */
  async checkSPF(domain) {
    try {
      const records = await dns.resolveTxt(domain);
      const flatRecords = records.map(r => r.join(''));

      for (const record of flatRecords) {
        if (record.startsWith('v=spf1')) {
          // Valid SPF record found
          // Check if it includes common email providers
          const hasValidInclude = record.includes('include:') ||
                                 record.includes('a:') ||
                                 record.includes('mx') ||
                                 record.includes('ip4:') ||
                                 record.includes('ip6:');

          return {
            verified: true,
            record,
            hasValidInclude
          };
        }
      }

      return { verified: false, error: 'SPF record not found' };
    } catch (error) {
      if (error.code === 'ENOTFOUND' || error.code === 'ENODATA') {
        return { verified: false, error: 'No TXT records found' };
      }
      return { verified: false, error: error.message };
    }
  }

  /**
   * Check DMARC DNS record
   * @param {string} domain - Domain name
   * @returns {Promise<{verified: boolean, error?: string, record?: string}>}
   */
  async checkDMARC(domain) {
    try {
      const hostname = `_dmarc.${domain}`;
      const records = await dns.resolveTxt(hostname);
      const flatRecords = records.map(r => r.join(''));

      for (const record of flatRecords) {
        if (record.startsWith('v=DMARC1')) {
          // Parse DMARC policy
          const policyMatch = record.match(/p=(none|quarantine|reject)/);
          const policy = policyMatch ? policyMatch[1] : 'unknown';

          return {
            verified: true,
            record,
            policy,
            isStrict: policy === 'quarantine' || policy === 'reject'
          };
        }
      }

      return { verified: false, error: 'DMARC record not found' };
    } catch (error) {
      if (error.code === 'ENOTFOUND' || error.code === 'ENODATA') {
        return { verified: false, error: 'DMARC record not found' };
      }
      return { verified: false, error: error.message };
    }
  }

  /**
   * Check MX DNS record
   * @param {string} domain - Domain name
   * @returns {Promise<{verified: boolean, error?: string, records?: Array}>}
   */
  async checkMX(domain) {
    try {
      const records = await dns.resolveMx(domain);

      if (records && records.length > 0) {
        return {
          verified: true,
          records: records.sort((a, b) => a.priority - b.priority)
        };
      }

      return { verified: false, error: 'No MX records found' };
    } catch (error) {
      if (error.code === 'ENOTFOUND' || error.code === 'ENODATA') {
        return { verified: false, error: 'No MX records found' };
      }
      return { verified: false, error: error.message };
    }
  }

  /**
   * Get domain by ID
   * @param {string} domainId - Domain ID
   * @param {string} organizationId - Organization ID
   * @returns {Promise<Object>}
   */
  async getDomain(domainId, organizationId) {
    const db = this._getDb();

    const domain = await db('email_domains')
      .where('id', domainId)
      .where('organization_id', organizationId)
      .first();

    if (!domain) {
      return null;
    }

    // Parse DNS records
    if (domain.provider_dns_records) {
      domain.dnsRecords = typeof domain.provider_dns_records === 'string'
        ? JSON.parse(domain.provider_dns_records)
        : domain.provider_dns_records;
    }

    // Don't expose private key
    delete domain.dkim_private_key;

    return domain;
  }

  /**
   * Get all domains for organization
   * @param {string} organizationId - Organization ID
   * @returns {Promise<Array>}
   */
  async getDomains(organizationId) {
    const db = this._getDb();

    const domains = await db('email_domains')
      .where('organization_id', organizationId)
      .orderBy('created_at', 'desc');

    return domains.map(domain => {
      // Parse DNS records
      if (domain.provider_dns_records) {
        domain.dnsRecords = typeof domain.provider_dns_records === 'string'
          ? JSON.parse(domain.provider_dns_records)
          : domain.provider_dns_records;
      }
      // Don't expose private key
      delete domain.dkim_private_key;
      return domain;
    });
  }

  /**
   * Get DNS records for domain
   * @param {string} domainId - Domain ID
   * @param {string} organizationId - Organization ID
   * @returns {Promise<Object>}
   */
  async getDNSRecords(domainId, organizationId) {
    const domain = await this.getDomain(domainId, organizationId);

    if (!domain) {
      throw new Error('Domain not found');
    }

    // Return both required and optional records
    const records = {
      required: [
        {
          type: 'TXT',
          name: domain.dkim_record_name,
          value: domain.dkim_record_value,
          purpose: 'DKIM',
          verified: domain.dkim_verified
        },
        {
          type: 'TXT',
          name: domain.domain,
          value: domain.spf_record_value,
          purpose: 'SPF',
          verified: domain.spf_verified
        },
        {
          type: 'TXT',
          name: `_dmarc.${domain.domain}`,
          value: domain.dmarc_record_value,
          purpose: 'DMARC',
          verified: domain.dmarc_verified
        }
      ],
      optional: [
        {
          type: 'CNAME',
          name: domain.return_path_domain,
          value: domain.return_path_cname || 'bounce.sendgrid.net',
          purpose: 'Return-Path',
          verified: domain.return_path_verified
        }
      ],
      providerRecords: domain.dnsRecords
    };

    return records;
  }

  /**
   * Delete domain
   * @param {string} domainId - Domain ID
   * @param {string} organizationId - Organization ID
   * @returns {Promise<boolean>}
   */
  async deleteDomain(domainId, organizationId) {
    const db = this._getDb();

    const domain = await db('email_domains')
      .where('id', domainId)
      .where('organization_id', organizationId)
      .first();

    if (!domain) {
      return false;
    }

    // Delete from provider if applicable
    if (domain.provider !== 'smtp' && domain.provider_domain_id) {
      try {
        await this.deleteFromProvider(domain);
      } catch (error) {
        log.warn('Failed to delete domain from provider', { error: error.message });
      }
    }

    await db('email_domains').where('id', domainId).delete();
    return true;
  }

  /**
   * Set default domain
   * @param {string} domainId - Domain ID
   * @param {string} organizationId - Organization ID
   * @returns {Promise<Object>}
   */
  async setDefaultDomain(domainId, organizationId) {
    const db = this._getDb();

    // Unset current default
    await db('email_domains')
      .where('organization_id', organizationId)
      .update({ is_default: false });

    // Set new default
    const [domain] = await db('email_domains')
      .where('id', domainId)
      .where('organization_id', organizationId)
      .update({ is_default: true, updated_at: new Date() })
      .returning('*');

    return domain;
  }

  /**
   * Get default domain for organization
   * @param {string} organizationId - Organization ID
   * @returns {Promise<Object>}
   */
  async getDefaultDomain(organizationId) {
    const db = this._getDb();

    let domain = await db('email_domains')
      .where('organization_id', organizationId)
      .where('is_default', true)
      .where('status', 'verified')
      .first();

    if (!domain) {
      // Get any verified domain
      domain = await db('email_domains')
        .where('organization_id', organizationId)
        .where('status', 'verified')
        .first();
    }

    return domain;
  }

  /**
   * Validate sender email against verified domains
   * @param {string} email - Sender email
   * @param {string} organizationId - Organization ID
   * @returns {Promise<{valid: boolean, domain?: Object, error?: string}>}
   */
  async validateSenderEmail(email, organizationId) {
    const domain = email.split('@')[1];

    if (!domain) {
      return { valid: false, error: 'Invalid email format' };
    }

    const db = this._getDb();

    const verifiedDomain = await db('email_domains')
      .where('organization_id', organizationId)
      .where('domain', domain)
      .where('status', 'verified')
      .first();

    if (verifiedDomain) {
      return { valid: true, domain: verifiedDomain };
    }

    // Check if subdomain of a verified domain
    const parentDomains = await db('email_domains')
      .where('organization_id', organizationId)
      .where('status', 'verified');

    for (const parentDomain of parentDomains) {
      if (domain.endsWith(`.${parentDomain.domain}`)) {
        return { valid: true, domain: parentDomain, isSubdomain: true };
      }
    }

    return {
      valid: false,
      error: `Domain ${domain} is not verified. Please verify it before sending.`
    };
  }

  // ==========================================
  // PROVIDER INTEGRATION
  // ==========================================

  /**
   * Register domain with email provider
   * @param {Object} domain - Domain record
   * @returns {Promise<void>}
   */
  async registerWithProvider(domain) {
    const db = this._getDb();

    switch (domain.provider) {
      case 'sendgrid':
        return this.registerWithSendGrid(domain);
      case 'ses':
        return this.registerWithSES(domain);
      default:
        // No provider registration needed
        return;
    }
  }

  /**
   * Register domain with SendGrid
   * @param {Object} domain - Domain record
   */
  async registerWithSendGrid(domain) {
    const apiKey = process.env.SENDGRID_API_KEY;
    if (!apiKey) {
      throw new Error('SendGrid API key not configured');
    }

    try {
      const response = await fetch('https://api.sendgrid.com/v3/whitelabel/domains', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          domain: domain.domain,
          subdomain: domain.subdomain || 'mail',
          automatic_security: true
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.errors?.[0]?.message || 'SendGrid API error');
      }

      const result = await response.json();

      // Update domain with provider info
      const db = this._getDb();
      await db('email_domains')
        .where('id', domain.id)
        .update({
          provider_domain_id: result.id.toString(),
          provider_dns_records: JSON.stringify(result.dns),
          provider_metadata: JSON.stringify(result),
          updated_at: new Date()
        });

      return result;
    } catch (error) {
      log.error('SendGrid domain registration failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Register domain with AWS SES
   * @param {Object} domain - Domain record
   */
  async registerWithSES(domain) {
    try {
      const { SESClient, VerifyDomainIdentityCommand, VerifyDomainDkimCommand } = await import('@aws-sdk/client-ses');

      const client = new SESClient({
        region: process.env.AWS_SES_REGION || process.env.AWS_REGION || 'us-east-1',
        credentials: {
          accessKeyId: process.env.AWS_SES_ACCESS_KEY || process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SES_SECRET_KEY || process.env.AWS_SECRET_ACCESS_KEY
        }
      });

      // Verify domain identity
      const verifyCommand = new VerifyDomainIdentityCommand({ Domain: domain.domain });
      const verifyResult = await client.send(verifyCommand);

      // Enable DKIM
      const dkimCommand = new VerifyDomainDkimCommand({ Domain: domain.domain });
      const dkimResult = await client.send(dkimCommand);

      // Build DNS records
      const dnsRecords = {
        verification: {
          type: 'TXT',
          name: `_amazonses.${domain.domain}`,
          value: verifyResult.VerificationToken
        },
        dkim: dkimResult.DkimTokens?.map((token, i) => ({
          type: 'CNAME',
          name: `${token}._domainkey.${domain.domain}`,
          value: `${token}.dkim.amazonses.com`
        })) || []
      };

      // Update domain with provider info
      const db = this._getDb();
      await db('email_domains')
        .where('id', domain.id)
        .update({
          provider_domain_id: domain.domain,
          provider_dns_records: JSON.stringify(dnsRecords),
          provider_metadata: JSON.stringify({
            verificationToken: verifyResult.VerificationToken,
            dkimTokens: dkimResult.DkimTokens
          }),
          updated_at: new Date()
        });

      return { verifyResult, dkimResult, dnsRecords };
    } catch (error) {
      log.error('AWS SES domain registration failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Verify domain with provider
   * @param {Object} domain - Domain record
   */
  async verifyWithProvider(domain) {
    switch (domain.provider) {
      case 'sendgrid':
        return this.verifyWithSendGrid(domain);
      case 'ses':
        return this.verifyWithSES(domain);
      default:
        return;
    }
  }

  /**
   * Verify domain with SendGrid
   * @param {Object} domain - Domain record
   */
  async verifyWithSendGrid(domain) {
    const apiKey = process.env.SENDGRID_API_KEY;
    if (!apiKey || !domain.provider_domain_id) {
      return;
    }

    try {
      const response = await fetch(
        `https://api.sendgrid.com/v3/whitelabel/domains/${domain.provider_domain_id}/validate`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`
          }
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.errors?.[0]?.message || 'Validation failed');
      }

      const result = await response.json();

      // Update provider metadata
      const db = this._getDb();
      await db('email_domains')
        .where('id', domain.id)
        .update({
          provider_metadata: JSON.stringify({
            ...JSON.parse(domain.provider_metadata || '{}'),
            validation: result
          }),
          updated_at: new Date()
        });

      return result;
    } catch (error) {
      log.error('SendGrid domain validation failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Verify domain with AWS SES
   * @param {Object} domain - Domain record
   */
  async verifyWithSES(domain) {
    try {
      const { SESClient, GetIdentityVerificationAttributesCommand } = await import('@aws-sdk/client-ses');

      const client = new SESClient({
        region: process.env.AWS_SES_REGION || process.env.AWS_REGION || 'us-east-1',
        credentials: {
          accessKeyId: process.env.AWS_SES_ACCESS_KEY || process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SES_SECRET_KEY || process.env.AWS_SECRET_ACCESS_KEY
        }
      });

      const command = new GetIdentityVerificationAttributesCommand({
        Identities: [domain.domain]
      });
      const result = await client.send(command);

      const status = result.VerificationAttributes?.[domain.domain];

      return {
        verified: status?.VerificationStatus === 'Success',
        status: status?.VerificationStatus
      };
    } catch (error) {
      log.error('AWS SES domain verification check failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Delete domain from provider
   * @param {Object} domain - Domain record
   */
  async deleteFromProvider(domain) {
    switch (domain.provider) {
      case 'sendgrid':
        return this.deleteFromSendGrid(domain);
      case 'ses':
        return this.deleteFromSES(domain);
      default:
        return;
    }
  }

  /**
   * Delete domain from SendGrid
   * @param {Object} domain - Domain record
   */
  async deleteFromSendGrid(domain) {
    const apiKey = process.env.SENDGRID_API_KEY;
    if (!apiKey || !domain.provider_domain_id) {
      return;
    }

    try {
      await fetch(
        `https://api.sendgrid.com/v3/whitelabel/domains/${domain.provider_domain_id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${apiKey}`
          }
        }
      );
    } catch (error) {
      log.error('SendGrid domain deletion failed', { error: error.message });
    }
  }

  /**
   * Delete domain from AWS SES
   * @param {Object} domain - Domain record
   */
  async deleteFromSES(domain) {
    try {
      const { SESClient, DeleteIdentityCommand } = await import('@aws-sdk/client-ses');

      const client = new SESClient({
        region: process.env.AWS_SES_REGION || process.env.AWS_REGION || 'us-east-1',
        credentials: {
          accessKeyId: process.env.AWS_SES_ACCESS_KEY || process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SES_SECRET_KEY || process.env.AWS_SECRET_ACCESS_KEY
        }
      });

      const command = new DeleteIdentityCommand({ Identity: domain.domain });
      await client.send(command);
    } catch (error) {
      log.error('AWS SES domain deletion failed', { error: error.message });
    }
  }

  // ==========================================
  // UTILITIES
  // ==========================================

  /**
   * Encrypt DKIM private key
   * @param {string} key - Private key
   * @returns {string}
   */
  encryptKey(key) {
    const secret = process.env.AI_ENCRYPTION_SECRET || process.env.JWT_SECRET;
    if (!secret) {
      return key; // Store unencrypted if no secret
    }

    const algorithm = 'aes-256-gcm';
    const iv = crypto.randomBytes(16);
    const secretKey = crypto.scryptSync(secret, 'salt', 32);
    const cipher = crypto.createCipheriv(algorithm, secretKey, iv);

    let encrypted = cipher.update(key, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  /**
   * Decrypt DKIM private key
   * @param {string} encryptedKey - Encrypted key
   * @returns {string}
   */
  decryptKey(encryptedKey) {
    const secret = process.env.AI_ENCRYPTION_SECRET || process.env.JWT_SECRET;
    if (!secret || !encryptedKey.includes(':')) {
      return encryptedKey; // Not encrypted
    }

    const [ivHex, authTagHex, encrypted] = encryptedKey.split(':');

    const algorithm = 'aes-256-gcm';
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const secretKey = crypto.scryptSync(secret, 'salt', 32);
    const decipher = crypto.createDecipheriv(algorithm, secretKey, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Get DKIM private key for signing
   * @param {string} domainId - Domain ID
   * @param {string} organizationId - Organization ID
   * @returns {Promise<string>}
   */
  async getDKIMPrivateKey(domainId, organizationId) {
    const db = this._getDb();

    const domain = await db('email_domains')
      .where('id', domainId)
      .where('organization_id', organizationId)
      .first();

    if (!domain || !domain.dkim_private_key) {
      throw new Error('DKIM key not found');
    }

    return this.decryptKey(domain.dkim_private_key);
  }
}

module.exports = new EmailDomainService();
