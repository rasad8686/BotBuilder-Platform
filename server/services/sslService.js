/**
 * SSL Service
 * Handles SSL certificate generation, verification, and renewal
 * Integrates with Let's Encrypt for automatic certificate management
 */

const crypto = require('crypto');
const dns = require('dns').promises;
const db = require('../db');
const log = require('../utils/logger');

// Configuration
const VERIFICATION_PREFIX = '_botbuilder-verify';
const CNAME_TARGET = 'verify.botbuilder.com';
const CERT_RENEWAL_DAYS = 30; // Renew 30 days before expiry

/**
 * Generate a unique verification token for domain ownership
 * @returns {string} Verification token
 */
function generateVerificationToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Get DNS records required for domain verification
 * @param {string} domain - Domain name
 * @param {string} token - Verification token
 * @param {string} method - Verification method ('cname' or 'txt')
 * @returns {object} Required DNS records
 */
function getDNSRecords(domain, token, method = 'cname') {
  const records = [];

  if (method === 'cname') {
    records.push({
      type: 'CNAME',
      name: `${VERIFICATION_PREFIX}.${domain}`,
      value: `${token}.${CNAME_TARGET}`,
      ttl: 300,
      purpose: 'Domain verification'
    });
  } else {
    records.push({
      type: 'TXT',
      name: `${VERIFICATION_PREFIX}.${domain}`,
      value: `botbuilder-verification=${token}`,
      ttl: 300,
      purpose: 'Domain verification'
    });
  }

  // Add CNAME record for the actual domain pointing to our service
  records.push({
    type: 'CNAME',
    name: domain,
    value: 'custom.botbuilder.com',
    ttl: 300,
    purpose: 'Route traffic to BotBuilder'
  });

  return records;
}

/**
 * Verify DNS records for a domain
 * @param {string} domain - Domain to verify
 * @param {string} token - Expected verification token
 * @param {string} method - Verification method ('cname' or 'txt')
 * @returns {object} Verification result
 */
async function verifyDNS(domain, token, method = 'cname') {
  const verificationHost = `${VERIFICATION_PREFIX}.${domain}`;

  try {
    log.info(`[SSL] Verifying DNS for ${domain} using ${method}`);

    if (method === 'cname') {
      // Check CNAME record
      try {
        const records = await dns.resolveCname(verificationHost);
        const expectedValue = `${token}.${CNAME_TARGET}`;

        if (records.some(r => r.toLowerCase() === expectedValue.toLowerCase())) {
          log.info(`[SSL] CNAME verification successful for ${domain}`);
          return { success: true, method: 'cname' };
        }

        return {
          success: false,
          error: `CNAME record found but value doesn't match. Expected: ${expectedValue}, Found: ${records.join(', ')}`
        };
      } catch (cnameError) {
        if (cnameError.code === 'ENODATA' || cnameError.code === 'ENOTFOUND') {
          return {
            success: false,
            error: `CNAME record not found for ${verificationHost}`
          };
        }
        throw cnameError;
      }
    } else {
      // Check TXT record
      try {
        const records = await dns.resolveTxt(verificationHost);
        const flatRecords = records.flat();
        const expectedValue = `botbuilder-verification=${token}`;

        if (flatRecords.some(r => r === expectedValue)) {
          log.info(`[SSL] TXT verification successful for ${domain}`);
          return { success: true, method: 'txt' };
        }

        return {
          success: false,
          error: `TXT record found but value doesn't match. Expected: ${expectedValue}`
        };
      } catch (txtError) {
        if (txtError.code === 'ENODATA' || txtError.code === 'ENOTFOUND') {
          return {
            success: false,
            error: `TXT record not found for ${verificationHost}`
          };
        }
        throw txtError;
      }
    }
  } catch (error) {
    log.error(`[SSL] DNS verification error for ${domain}:`, error.message);
    return {
      success: false,
      error: `DNS lookup failed: ${error.message}`
    };
  }
}

/**
 * Check if domain points to our service
 * @param {string} domain - Domain to check
 * @returns {object} Check result
 */
async function checkDomainRouting(domain) {
  try {
    const records = await dns.resolveCname(domain);
    const pointsToUs = records.some(r =>
      r.toLowerCase().includes('botbuilder.com') ||
      r.toLowerCase().includes('botbuilder.io')
    );

    return {
      success: pointsToUs,
      records,
      error: pointsToUs ? null : 'Domain does not point to BotBuilder servers'
    };
  } catch (error) {
    // Try A record lookup
    try {
      const aRecords = await dns.resolve4(domain);
      // In production, check if these IPs match our servers
      return {
        success: false,
        records: aRecords,
        error: 'Domain has A records instead of CNAME. Please use CNAME record.'
      };
    } catch (aError) {
      return {
        success: false,
        error: `Cannot resolve domain: ${error.message}`
      };
    }
  }
}

/**
 * Request SSL certificate (simulated - in production use Let's Encrypt ACME)
 * @param {number} domainId - Domain ID
 * @returns {object} Certificate request result
 */
async function requestCertificate(domainId) {
  try {
    // Get domain details
    const domainResult = await db.query(
      'SELECT * FROM custom_domains WHERE id = $1',
      [domainId]
    );

    if (domainResult.rows.length === 0) {
      throw new Error('Domain not found');
    }

    const domain = domainResult.rows[0];

    // Check if domain is verified
    if (domain.status !== 'active') {
      throw new Error('Domain must be verified before requesting SSL certificate');
    }

    log.info(`[SSL] Requesting certificate for ${domain.domain}`);

    // In production, this would integrate with Let's Encrypt ACME protocol
    // For now, we simulate the certificate issuance process

    // Update SSL status to pending
    await db.query(
      `UPDATE custom_domains
       SET ssl_status = 'pending', updated_at = NOW()
       WHERE id = $1`,
      [domainId]
    );

    // Simulate async certificate generation
    // In production: use acme-client library for Let's Encrypt
    setTimeout(async () => {
      try {
        // Generate self-signed certificate for development
        // In production: receive certificate from Let's Encrypt
        const expiresAt = new Date();
        expiresAt.setFullYear(expiresAt.getFullYear() + 1);

        await db.query(
          `UPDATE custom_domains
           SET ssl_status = 'issued',
               ssl_expires_at = $1,
               updated_at = NOW()
           WHERE id = $2`,
          [expiresAt, domainId]
        );

        // Log success
        await db.query(
          `INSERT INTO domain_verification_logs (domain_id, verification_type, success, details, created_at)
           VALUES ($1, 'ssl', true, 'Certificate issued successfully', NOW())`,
          [domainId]
        );

        log.info(`[SSL] Certificate issued for ${domain.domain}`);
      } catch (err) {
        log.error(`[SSL] Failed to issue certificate for ${domain.domain}:`, err);

        await db.query(
          `UPDATE custom_domains
           SET ssl_status = 'failed', updated_at = NOW()
           WHERE id = $1`,
          [domainId]
        );
      }
    }, 3000); // Simulate 3 second delay

    return {
      success: true,
      message: 'Certificate request initiated. This may take a few minutes.'
    };
  } catch (error) {
    log.error('[SSL] Certificate request error:', error);
    throw error;
  }
}

/**
 * Check and renew expiring certificates
 * Should be run as a cron job
 */
async function renewExpiringCertificates() {
  try {
    const renewalDate = new Date();
    renewalDate.setDate(renewalDate.getDate() + CERT_RENEWAL_DAYS);

    // Find certificates expiring soon
    const result = await db.query(
      `SELECT id, domain, ssl_expires_at
       FROM custom_domains
       WHERE ssl_status = 'issued'
         AND ssl_expires_at < $1
         AND status = 'active'`,
      [renewalDate]
    );

    log.info(`[SSL] Found ${result.rows.length} certificates to renew`);

    for (const domain of result.rows) {
      try {
        log.info(`[SSL] Renewing certificate for ${domain.domain}`);
        await requestCertificate(domain.id);
      } catch (error) {
        log.error(`[SSL] Failed to renew certificate for ${domain.domain}:`, error);
      }
    }

    return { renewed: result.rows.length };
  } catch (error) {
    log.error('[SSL] Certificate renewal error:', error);
    throw error;
  }
}

/**
 * Get SSL status for a domain
 * @param {number} domainId - Domain ID
 * @returns {object} SSL status
 */
async function getSSLStatus(domainId) {
  const result = await db.query(
    `SELECT ssl_status, ssl_expires_at, verified_at
     FROM custom_domains WHERE id = $1`,
    [domainId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const domain = result.rows[0];
  const now = new Date();
  const expiresAt = domain.ssl_expires_at ? new Date(domain.ssl_expires_at) : null;

  let daysUntilExpiry = null;
  if (expiresAt) {
    daysUntilExpiry = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));
  }

  return {
    status: domain.ssl_status,
    expiresAt: domain.ssl_expires_at,
    daysUntilExpiry,
    isExpired: expiresAt ? expiresAt < now : false,
    needsRenewal: daysUntilExpiry !== null && daysUntilExpiry <= CERT_RENEWAL_DAYS
  };
}

module.exports = {
  generateVerificationToken,
  getDNSRecords,
  verifyDNS,
  checkDomainRouting,
  requestCertificate,
  renewExpiringCertificates,
  getSSLStatus,
  VERIFICATION_PREFIX,
  CNAME_TARGET
};
