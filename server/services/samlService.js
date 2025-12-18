/**
 * SAML Service
 * Handles SAML 2.0 authentication flows
 */

const crypto = require('crypto');
const zlib = require('zlib');
const { promisify } = require('util');
const SSOService = require('./ssoService');
const log = require('../utils/logger');

const inflateRaw = promisify(zlib.inflateRaw);
const deflateRaw = promisify(zlib.deflateRaw);

class SAMLService {
  /**
   * Generate SAML AuthnRequest
   * @param {number} configId - SSO Configuration ID
   * @param {string} relayState - State to return after auth
   * @returns {Object} { url, id }
   */
  static async generateAuthRequest(configId, relayState = '') {
    try {
      const config = await SSOService.getFullConfig(configId);

      if (!config) {
        throw new Error('SSO configuration not found');
      }

      const baseUrl = process.env.APP_URL || 'http://localhost:3000';
      const acsUrl = config.acs_url || `${baseUrl}/api/sso/saml/acs`;
      const entityId = config.entity_id || `${baseUrl}/api/sso/saml/metadata`;

      // Generate request ID
      const requestId = '_' + crypto.randomBytes(21).toString('hex');
      const issueInstant = new Date().toISOString();

      // Build SAML AuthnRequest
      const authnRequest = `<?xml version="1.0" encoding="UTF-8"?>
<samlp:AuthnRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
                    xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
                    ID="${requestId}"
                    Version="2.0"
                    IssueInstant="${issueInstant}"
                    Destination="${config.settings?.sso_url || ''}"
                    AssertionConsumerServiceURL="${acsUrl}"
                    ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST">
  <saml:Issuer>${entityId}</saml:Issuer>
  <samlp:NameIDPolicy Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress"
                      AllowCreate="true"/>
</samlp:AuthnRequest>`;

      // Deflate and encode for redirect binding
      const deflated = await deflateRaw(Buffer.from(authnRequest, 'utf8'));
      const encoded = deflated.toString('base64');
      const urlEncoded = encodeURIComponent(encoded);

      // Get SSO URL from metadata or settings
      let ssoUrl = config.settings?.sso_url;

      // If metadata URL is provided, try to fetch SSO URL
      if (!ssoUrl && config.metadata_url) {
        ssoUrl = await this.fetchSSOUrlFromMetadata(config.metadata_url);
      }

      if (!ssoUrl) {
        throw new Error('SSO URL not configured');
      }

      // Build redirect URL
      let redirectUrl = `${ssoUrl}?SAMLRequest=${urlEncoded}`;

      if (relayState) {
        redirectUrl += `&RelayState=${encodeURIComponent(relayState)}`;
      }

      log.info('SAML AuthnRequest generated', { configId, requestId });

      return {
        url: redirectUrl,
        id: requestId,
        request: authnRequest
      };
    } catch (error) {
      log.error('Error generating SAML AuthnRequest:', { error: error.message, configId });
      throw error;
    }
  }

  /**
   * Parse SAML Response/Assertion
   * @param {string} samlResponse - Base64 encoded SAML Response
   * @param {number} configId - SSO Configuration ID
   * @returns {Object} Parsed assertion data
   */
  static async parseAssertion(samlResponse, configId) {
    try {
      const config = await SSOService.getFullConfig(configId);

      if (!config) {
        throw new Error('SSO configuration not found');
      }

      // Decode SAML Response
      const decodedResponse = Buffer.from(samlResponse, 'base64').toString('utf8');

      // Parse XML (simple parsing without heavy dependencies)
      const assertion = this.extractAssertionFromResponse(decodedResponse);

      if (!assertion) {
        throw new Error('No assertion found in SAML response');
      }

      // Validate signature if certificate is provided
      if (config.certificate) {
        const isValid = await this.validateSignature(decodedResponse, config.certificate);
        if (!isValid) {
          throw new Error('Invalid SAML signature');
        }
      }

      // Check conditions
      const conditions = this.extractConditions(assertion);
      this.validateConditions(conditions);

      // Extract user attributes
      const userAttributes = this.extractUserAttributes(assertion);

      log.info('SAML assertion parsed successfully', { configId, email: userAttributes.email });

      return {
        success: true,
        user: userAttributes,
        sessionIndex: this.extractSessionIndex(decodedResponse),
        rawAssertion: assertion
      };
    } catch (error) {
      log.error('Error parsing SAML assertion:', { error: error.message, configId });
      throw error;
    }
  }

  /**
   * Validate SAML signature
   * @param {string} xml - XML document
   * @param {string} certificate - X.509 certificate
   * @returns {boolean} Is signature valid
   */
  static async validateSignature(xml, certificate) {
    try {
      // Extract signature value
      const signatureMatch = xml.match(/<ds:SignatureValue[^>]*>([^<]+)<\/ds:SignatureValue>/);
      if (!signatureMatch) {
        log.warn('No signature found in SAML response');
        return true; // Allow unsigned responses in dev
      }

      const signatureValue = signatureMatch[1].replace(/\s/g, '');

      // Extract signed info
      const signedInfoMatch = xml.match(/<ds:SignedInfo[^>]*>([\s\S]*?)<\/ds:SignedInfo>/);
      if (!signedInfoMatch) {
        throw new Error('SignedInfo not found');
      }

      // Canonicalize signed info (simplified)
      const signedInfo = signedInfoMatch[0]
        .replace(/\r\n/g, '\n')
        .replace(/\n/g, '')
        .trim();

      // Verify signature
      const verifier = crypto.createVerify('RSA-SHA256');
      verifier.update(signedInfo);

      // Format certificate
      const formattedCert = this.formatCertificate(certificate);

      const isValid = verifier.verify(formattedCert, signatureValue, 'base64');

      return isValid;
    } catch (error) {
      log.error('Signature validation error:', { error: error.message });
      // In development, allow failures
      if (process.env.NODE_ENV !== 'production') {
        log.warn('Signature validation bypassed in development mode');
        return true;
      }
      return false;
    }
  }

  /**
   * Extract user attributes from assertion
   * @param {string} assertion - SAML assertion XML
   * @returns {Object} User attributes
   */
  static extractUserAttributes(assertion) {
    const attributes = {};

    // Extract NameID (usually email)
    const nameIdMatch = assertion.match(/<saml:NameID[^>]*>([^<]+)<\/saml:NameID>/);
    if (nameIdMatch) {
      attributes.nameId = nameIdMatch[1].trim();
    }

    // Extract email from various attribute names
    const emailPatterns = [
      /Name="email"[^>]*>\s*<saml:AttributeValue[^>]*>([^<]+)/i,
      /Name="http:\/\/schemas\.xmlsoap\.org\/ws\/2005\/05\/identity\/claims\/emailaddress"[^>]*>\s*<saml:AttributeValue[^>]*>([^<]+)/i,
      /Name="mail"[^>]*>\s*<saml:AttributeValue[^>]*>([^<]+)/i,
      /Name="Email"[^>]*>\s*<saml:AttributeValue[^>]*>([^<]+)/i
    ];

    for (const pattern of emailPatterns) {
      const match = assertion.match(pattern);
      if (match) {
        attributes.email = match[1].trim();
        break;
      }
    }

    // Use NameID as email if no email attribute found
    if (!attributes.email && attributes.nameId && attributes.nameId.includes('@')) {
      attributes.email = attributes.nameId;
    }

    // Extract first name
    const firstNamePatterns = [
      /Name="firstName"[^>]*>\s*<saml:AttributeValue[^>]*>([^<]+)/i,
      /Name="http:\/\/schemas\.xmlsoap\.org\/ws\/2005\/05\/identity\/claims\/givenname"[^>]*>\s*<saml:AttributeValue[^>]*>([^<]+)/i,
      /Name="givenName"[^>]*>\s*<saml:AttributeValue[^>]*>([^<]+)/i
    ];

    for (const pattern of firstNamePatterns) {
      const match = assertion.match(pattern);
      if (match) {
        attributes.firstName = match[1].trim();
        break;
      }
    }

    // Extract last name
    const lastNamePatterns = [
      /Name="lastName"[^>]*>\s*<saml:AttributeValue[^>]*>([^<]+)/i,
      /Name="http:\/\/schemas\.xmlsoap\.org\/ws\/2005\/05\/identity\/claims\/surname"[^>]*>\s*<saml:AttributeValue[^>]*>([^<]+)/i,
      /Name="sn"[^>]*>\s*<saml:AttributeValue[^>]*>([^<]+)/i
    ];

    for (const pattern of lastNamePatterns) {
      const match = assertion.match(pattern);
      if (match) {
        attributes.lastName = match[1].trim();
        break;
      }
    }

    // Extract display name
    const displayNamePatterns = [
      /Name="displayName"[^>]*>\s*<saml:AttributeValue[^>]*>([^<]+)/i,
      /Name="http:\/\/schemas\.xmlsoap\.org\/ws\/2005\/05\/identity\/claims\/name"[^>]*>\s*<saml:AttributeValue[^>]*>([^<]+)/i
    ];

    for (const pattern of displayNamePatterns) {
      const match = assertion.match(pattern);
      if (match) {
        attributes.displayName = match[1].trim();
        break;
      }
    }

    // Extract groups/roles
    const groupPatterns = [
      /Name="groups"[^>]*>\s*<saml:AttributeValue[^>]*>([^<]+)/gi,
      /Name="http:\/\/schemas\.microsoft\.com\/ws\/2008\/06\/identity\/claims\/groups"[^>]*>\s*<saml:AttributeValue[^>]*>([^<]+)/gi
    ];

    attributes.groups = [];
    for (const pattern of groupPatterns) {
      let match;
      while ((match = pattern.exec(assertion)) !== null) {
        attributes.groups.push(match[1].trim());
      }
    }

    // Extract external ID (subject)
    const subjectMatch = assertion.match(/<saml:Subject>[\s\S]*?<saml:NameID[^>]*>([^<]+)/);
    if (subjectMatch) {
      attributes.externalId = subjectMatch[1].trim();
    }

    return attributes;
  }

  /**
   * Generate SAML LogoutRequest
   * @param {number} configId - SSO Configuration ID
   * @param {string} nameId - User's NameID
   * @param {string} sessionIndex - SAML session index
   * @returns {Object} { url, id }
   */
  static async generateLogoutRequest(configId, nameId, sessionIndex) {
    try {
      const config = await SSOService.getFullConfig(configId);

      if (!config) {
        throw new Error('SSO configuration not found');
      }

      const baseUrl = process.env.APP_URL || 'http://localhost:3000';
      const entityId = config.entity_id || `${baseUrl}/api/sso/saml/metadata`;

      const requestId = '_' + crypto.randomBytes(21).toString('hex');
      const issueInstant = new Date().toISOString();

      const sloUrl = config.settings?.slo_url;

      if (!sloUrl) {
        log.warn('SLO URL not configured, logout request skipped', { configId });
        return null;
      }

      const logoutRequest = `<?xml version="1.0" encoding="UTF-8"?>
<samlp:LogoutRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
                     xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
                     ID="${requestId}"
                     Version="2.0"
                     IssueInstant="${issueInstant}"
                     Destination="${sloUrl}">
  <saml:Issuer>${entityId}</saml:Issuer>
  <saml:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">${nameId}</saml:NameID>
  ${sessionIndex ? `<samlp:SessionIndex>${sessionIndex}</samlp:SessionIndex>` : ''}
</samlp:LogoutRequest>`;

      const deflated = await deflateRaw(Buffer.from(logoutRequest, 'utf8'));
      const encoded = deflated.toString('base64');
      const urlEncoded = encodeURIComponent(encoded);

      const redirectUrl = `${sloUrl}?SAMLRequest=${urlEncoded}`;

      log.info('SAML LogoutRequest generated', { configId, requestId });

      return {
        url: redirectUrl,
        id: requestId
      };
    } catch (error) {
      log.error('Error generating SAML LogoutRequest:', { error: error.message, configId });
      throw error;
    }
  }

  /**
   * Handle SAML LogoutResponse
   * @param {string} samlResponse - Base64 encoded response
   * @param {number} configId - SSO Configuration ID
   * @returns {Object} Parsed response
   */
  static async handleLogoutResponse(samlResponse, configId) {
    try {
      const decoded = Buffer.from(samlResponse, 'base64').toString('utf8');

      // Check status
      const statusMatch = decoded.match(/<samlp:StatusCode[^>]*Value="([^"]+)"/);
      const status = statusMatch ? statusMatch[1] : 'unknown';

      const isSuccess = status.includes('Success');

      log.info('SAML LogoutResponse processed', { configId, success: isSuccess });

      return {
        success: isSuccess,
        status
      };
    } catch (error) {
      log.error('Error handling SAML LogoutResponse:', { error: error.message, configId });
      throw error;
    }
  }

  /**
   * Fetch SSO URL from IdP metadata
   * @param {string} metadataUrl - Metadata URL
   * @returns {string|null} SSO URL
   */
  static async fetchSSOUrlFromMetadata(metadataUrl) {
    try {
      const https = require('https');
      const http = require('http');
      const url = new URL(metadataUrl);
      const protocol = url.protocol === 'https:' ? https : http;

      return new Promise((resolve) => {
        protocol.get(metadataUrl, { timeout: 10000 }, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            // Extract SingleSignOnService URL with HTTP-Redirect binding
            const ssoMatch = data.match(
              /SingleSignOnService[^>]*Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect"[^>]*Location="([^"]+)"/
            ) || data.match(
              /SingleSignOnService[^>]*Location="([^"]+)"[^>]*Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect"/
            );

            resolve(ssoMatch ? ssoMatch[1] : null);
          });
        }).on('error', () => resolve(null));
      });
    } catch (error) {
      log.error('Error fetching SSO URL from metadata:', { error: error.message });
      return null;
    }
  }

  /**
   * Extract assertion from SAML Response
   * @param {string} response - SAML Response XML
   * @returns {string|null} Assertion XML
   */
  static extractAssertionFromResponse(response) {
    const assertionMatch = response.match(/<saml:Assertion[^>]*>[\s\S]*?<\/saml:Assertion>/);
    return assertionMatch ? assertionMatch[0] : null;
  }

  /**
   * Extract conditions from assertion
   * @param {string} assertion - Assertion XML
   * @returns {Object} Conditions
   */
  static extractConditions(assertion) {
    const conditions = {};

    const notBeforeMatch = assertion.match(/NotBefore="([^"]+)"/);
    if (notBeforeMatch) {
      conditions.notBefore = new Date(notBeforeMatch[1]);
    }

    const notOnOrAfterMatch = assertion.match(/NotOnOrAfter="([^"]+)"/);
    if (notOnOrAfterMatch) {
      conditions.notOnOrAfter = new Date(notOnOrAfterMatch[1]);
    }

    return conditions;
  }

  /**
   * Validate assertion conditions
   * @param {Object} conditions - Extracted conditions
   */
  static validateConditions(conditions) {
    const now = new Date();
    const clockSkew = 5 * 60 * 1000; // 5 minutes

    if (conditions.notBefore) {
      const notBefore = new Date(conditions.notBefore.getTime() - clockSkew);
      if (now < notBefore) {
        throw new Error('Assertion not yet valid');
      }
    }

    if (conditions.notOnOrAfter) {
      const notOnOrAfter = new Date(conditions.notOnOrAfter.getTime() + clockSkew);
      if (now >= notOnOrAfter) {
        throw new Error('Assertion has expired');
      }
    }
  }

  /**
   * Extract session index from response
   * @param {string} response - SAML Response
   * @returns {string|null} Session index
   */
  static extractSessionIndex(response) {
    const match = response.match(/SessionIndex="([^"]+)"/);
    return match ? match[1] : null;
  }

  /**
   * Format X.509 certificate
   * @param {string} cert - Certificate string
   * @returns {string} Formatted PEM certificate
   */
  static formatCertificate(cert) {
    // Remove headers if present
    let cleanCert = cert
      .replace(/-----BEGIN CERTIFICATE-----/g, '')
      .replace(/-----END CERTIFICATE-----/g, '')
      .replace(/\s/g, '');

    // Add PEM headers and format
    const lines = cleanCert.match(/.{1,64}/g) || [];
    return `-----BEGIN CERTIFICATE-----\n${lines.join('\n')}\n-----END CERTIFICATE-----`;
  }
}

module.exports = SAMLService;
